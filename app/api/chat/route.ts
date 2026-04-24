import { NextResponse } from "next/server";
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
    semesterName?: string;
    nextClass?: string | null;
  };
};

function isMissionTopic(value: unknown): value is MissionTopic {
  if (!value || typeof value !== "object") {
    return false;
  }
  const v = value as Record<string, unknown>;
  return typeof v.courseName === "string" && typeof v.topicTitle === "string";
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

  if (!allowAiRequest(uid)) {
    return NextResponse.json({ error: "Too many AI requests this hour. Try later." }, { status: 429 });
  }

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
              "You are an elite study coach. Generate exactly 2 concise sentences as a Study Mission. Be specific and action-oriented. Mention one topic by name and one concrete review action.",
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
      return NextResponse.json({ error: "OpenAI request failed." }, { status: 502 });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const mission = data.choices?.[0]?.message?.content?.trim();
    if (!mission) {
      return NextResponse.json({ error: "Empty mission response." }, { status: 502 });
    }

    return NextResponse.json({ mission });
  } catch {
    return NextResponse.json({ error: "Could not generate mission right now." }, { status: 502 });
  }
}
