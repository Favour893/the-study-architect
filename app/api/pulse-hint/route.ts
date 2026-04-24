import { NextResponse } from "next/server";
import { allowAiRequest } from "@/lib/server/ai-rate-limit";
import { fetchPulseStudyHint } from "@/lib/server/fetch-pulse-study-hint";
import { verifyFirebaseIdToken } from "@/lib/server/verify-firebase-id-token";
import type { PulseHintContext } from "@/lib/types/pulse-hint";

export const runtime = "nodejs";

type RequestBody = {
  idToken?: string;
  context?: PulseHintContext;
};

function isPulseHintContext(value: unknown): value is PulseHintContext {
  if (!value || typeof value !== "object") {
    return false;
  }
  const v = value as Record<string, unknown>;
  return typeof v.pulseTitle === "string" && typeof v.pulseBody === "string";
}

export async function POST(request: Request) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return NextResponse.json({ error: "Missing Firebase project configuration." }, { status: 500 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI hints are not enabled on this deployment (missing OPENAI_API_KEY)." },
      { status: 503 },
    );
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = json as RequestBody;
  if (!body.idToken || typeof body.idToken !== "string") {
    return NextResponse.json({ error: "Missing or invalid idToken." }, { status: 401 });
  }

  if (!body.context || !isPulseHintContext(body.context)) {
    return NextResponse.json({ error: "Missing or invalid context." }, { status: 400 });
  }

  let uid: string;
  try {
    uid = await verifyFirebaseIdToken(body.idToken, projectId);
  } catch {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  if (!allowAiRequest(uid)) {
    return NextResponse.json(
      { error: "Too many AI requests this hour. Try again later." },
      { status: 429 },
    );
  }

  try {
    const hint = await fetchPulseStudyHint(body.context, apiKey, model);
    return NextResponse.json({ hint });
  } catch {
    return NextResponse.json({ error: "Could not generate a suggestion right now." }, { status: 502 });
  }
}
