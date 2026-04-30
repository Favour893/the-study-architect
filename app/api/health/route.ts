import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
  const hasFirebaseProjectId = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID.trim(),
  );
  const hasUpstashRedis =
    Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim()) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN?.trim());

  return NextResponse.json(
    {
      ok: hasOpenAiKey && hasFirebaseProjectId,
      env: {
        OPENAI_API_KEY: hasOpenAiKey ? "present" : "missing",
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: hasFirebaseProjectId ? "present" : "missing",
        UPSTASH_REDIS_RATE_LIMIT: hasUpstashRedis ? "present" : "missing",
      },
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
