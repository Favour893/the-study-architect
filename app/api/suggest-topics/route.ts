import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { allowAiRequest } from "@/lib/server/ai-rate-limit";
import { verifyFirebaseIdToken } from "@/lib/server/verify-firebase-id-token";

export const runtime = "nodejs";

type SuggestTopicsBody = {
  idToken?: string;
  programmeOfStudy?: string | null;
  courseTitle?: string;
  courseCode?: string | null;
  existingTopicTitles?: unknown;
  /** Combined plain-text excerpts from user-imported course documents (client-built). */
  documentContext?: string | null;
};

function normalizeTitles(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

async function openAiSuggestTopics(
  apiKey: string,
  model: string,
  payload: {
    programmeOfStudy: string;
    courseTitle: string;
    courseCode: string | null;
    existingTopicTitles: string[];
    importedCourseMaterial: string;
  },
): Promise<{ ok: true; topics: string[] } | { ok: false; status: number }> {
  const system =
    'Return ONLY a JSON object with a single key "topics" whose value is an array of strings. ' +
    "Each string is one syllabus-style topic title for the given course (typical university depth). " +
    "Topics must be substantive subject-matter units for that course within the stated programme of study. " +
    "Do not output generic study skills, exam tips, or time management unless the course is explicitly about those. " +
    "Use 8–12 titles when the course scope is broad; 5–8 for narrow courses. " +
    "Each title should be short (about 3–10 words). " +
    "Do not repeat or closely duplicate any string listed in existingTopicTitles. " +
    "When importedCourseMaterial is non-empty, derive titles primarily from that material (modules, weeks, learning outcomes, headings) while staying consistent with the programme and course name; ignore boilerplate or unrelated text.";

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: JSON.stringify({
                programmeOfStudy: payload.programmeOfStudy,
                courseTitle: payload.courseTitle,
                courseCode: payload.courseCode,
                existingTopicTitles: payload.existingTopicTitles.slice(0, 80),
                importedCourseMaterial: payload.importedCourseMaterial,
              }),
            },
          ],
          max_tokens: 900,
          temperature: 0.45,
        }),
      });

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 250 * attempt * attempt));
          continue;
        }
        return { ok: false, status: response.status };
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return { ok: false, status: 502 };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content) as { topics?: unknown };
      } catch {
        return { ok: false, status: 502 };
      }

      if (!parsed || typeof parsed !== "object" || !("topics" in parsed)) {
        return { ok: false, status: 502 };
      }

      const topics = normalizeTitles((parsed as { topics: unknown }).topics).slice(0, 20);
      if (topics.length === 0) {
        return { ok: false, status: 502 };
      }

      return { ok: true, topics };
    } catch {
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt * attempt));
        continue;
      }
      return { ok: false, status: 502 };
    }
  }

  return { ok: false, status: 502 };
}

export async function POST(request: Request) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return NextResponse.json({ error: "Missing Firebase project configuration." }, { status: 500 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 503 });
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  let body: SuggestTopicsBody;
  try {
    body = (await request.json()) as SuggestTopicsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.idToken || typeof body.idToken !== "string") {
    return NextResponse.json({ error: "Missing idToken." }, { status: 401 });
  }

  const programmeOfStudy = typeof body.programmeOfStudy === "string" ? body.programmeOfStudy.trim() : "";
  if (!programmeOfStudy) {
    return NextResponse.json(
      { error: "Add your programme of study in the account menu to use AI topic suggestions." },
      { status: 400 },
    );
  }

  const courseTitle = typeof body.courseTitle === "string" ? body.courseTitle.trim() : "";
  if (!courseTitle) {
    return NextResponse.json({ error: "Missing course title." }, { status: 400 });
  }

  const courseCode =
    typeof body.courseCode === "string" && body.courseCode.trim() ? body.courseCode.trim() : null;

  const existingTopicTitles = normalizeTitles(body.existingTopicTitles).slice(0, 80);

  const importedCourseMaterial =
    typeof body.documentContext === "string" ? body.documentContext.trim().slice(0, 32_000) : "";

  let uid: string;
  try {
    uid = await verifyFirebaseIdToken(body.idToken, projectId);
  } catch {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  if (!(await allowAiRequest(uid))) {
    return NextResponse.json({ error: "Too many AI requests this hour. Try later." }, { status: 429 });
  }

  const result = await openAiSuggestTopics(apiKey, model, {
    programmeOfStudy,
    courseTitle,
    courseCode,
    existingTopicTitles,
    importedCourseMaterial,
  });

  if (!result.ok) {
    Sentry.captureMessage("OpenAI suggest-topics failed", {
      level: "error",
      extra: { status: result.status, courseTitle },
    });
    return NextResponse.json({ error: "Could not generate topic suggestions right now." }, { status: 502 });
  }

  return NextResponse.json({ topics: result.topics });
}
