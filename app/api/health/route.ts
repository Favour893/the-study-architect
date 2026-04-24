import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
  const hasFirebaseProjectId = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID.trim(),
  );

  return NextResponse.json(
    {
      ok: hasOpenAiKey && hasFirebaseProjectId,
      env: {
        OPENAI_API_KEY: hasOpenAiKey ? "present" : "missing",
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: hasFirebaseProjectId ? "present" : "missing",
      },
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
