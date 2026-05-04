import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { allowAiRequest } from "@/lib/server/ai-rate-limit";
import { verifyFirebaseIdToken } from "@/lib/server/verify-firebase-id-token";

export const runtime = "nodejs";

type MissionTopic = {
  courseName: string;
  topicTitle: string;
  notes?: string;
  isFromNextClass?: boolean;
};

type MissionRequest = {
  idToken?: string;
  topics?: MissionTopic[];
  context?: {
    pulseTitle?: string;
    pulseBody?: string;
    semesterName?: string | null;
    nextClass?: string | null;
    programmeOfStudy?: string | null;
    /** Excerpt from user-imported docs for the course matching the next class (if any). */
    importedReferenceForNextClass?: string | null;
  };
};

function isMissionTopic(value: unknown): value is MissionTopic {
  if (!value || typeof value !== "object") {
    return false;
  }
  const v = value as Record<string, unknown>;
  return typeof v.courseName === "string" && typeof v.topicTitle === "string";
}

async function openAiChatWithRetry(apiKey: string, model: string, payload: MissionRequest, topics: MissionTopic[]) {
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
          messages: [
            {
              role: "system",
              content:
                "You are an elite study coach. Return STRICT JSON with keys mission and reasoning. mission must be exactly 2 concise sentences, specific and action-oriented, mentioning one topic by name and one concrete review action. reasoning must be exactly 1 sentence explaining why that mission was selected based on urgency/timing/status. When context.programmeOfStudy is provided, tailor examples and tactics to that programme (without inventing unrelated majors). When context.importedReferenceForNextClass is non-empty, keep the mission aligned with that user-uploaded course material and the selected topic; do not invent content outside that scope.",
            },
            {
              role: "user",
              content: JSON.stringify({
                context: payload.context ?? {},
                taughtTopics: topics.map((topic) => ({
                  course: topic.courseName,
                  topic: topic.topicTitle,
                  notes: topic.notes ?? "",
                  nextClassPriority: Boolean(topic.isFromNextClass),
                })),
              }),
            },
          ],
          max_tokens: 180,
          temperature: 0.4,
        }),
      });

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 250 * attempt * attempt));
          continue;
        }
        return { ok: false as const, status: response.status };
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return { ok: false as const, status: 502 };
      }
      try {
        const parsed = JSON.parse(content) as { mission?: string; reasoning?: string };
        const mission = typeof parsed.mission === "string" ? parsed.mission.trim() : "";
        const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "";
        if (!mission || !reasoning) {
          return { ok: false as const, status: 502 };
        }
        return { ok: true as const, mission, reasoning };
      } catch {
        return { ok: false as const, status: 502 };
      }
    } catch {
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt * attempt));
        continue;
      }
      return { ok: false as const, status: 502 };
    }
  }
  return { ok: false as const, status: 502 };
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

  let payload: MissionRequest;
  try {
    payload = (await request.json()) as MissionRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    payload.context &&
    typeof payload.context.importedReferenceForNextClass === "string" &&
    payload.context.importedReferenceForNextClass.length > 32_000
  ) {
    payload.context.importedReferenceForNextClass = payload.context.importedReferenceForNextClass.slice(0, 32_000);
  }

  if (!payload.idToken || typeof payload.idToken !== "string") {
    return NextResponse.json({ error: "Missing idToken." }, { status: 401 });
  }

  const topics = Array.isArray(payload.topics)
    ? payload.topics.filter(isMissionTopic).slice(0, 3)
    : [];
  if (topics.length === 0) {
    return NextResponse.json({ error: "Provide at least one taught topic." }, { status: 400 });
  }

  let uid: string;
  try {
    uid = await verifyFirebaseIdToken(payload.idToken, projectId);
  } catch {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  if (!(await allowAiRequest(uid))) {
    return NextResponse.json({ error: "Too many AI requests this hour. Try later." }, { status: 429 });
  }

  const result = await openAiChatWithRetry(apiKey, model, payload, topics);
  if (!result.ok) {
    Sentry.captureMessage("OpenAI chat generation failed", {
      level: "error",
      extra: { status: result.status, topicCount: topics.length },
    });
    return NextResponse.json({ error: "Could not generate mission right now." }, { status: 502 });
  }
  return NextResponse.json({ mission: result.mission, reasoning: result.reasoning });
}
