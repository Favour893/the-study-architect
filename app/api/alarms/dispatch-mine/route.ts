import { NextResponse } from "next/server";
import { dispatchDueAlarmJobsForUser } from "@/lib/server/dispatch-alarms";
import { verifyFirebaseIdToken } from "@/lib/server/verify-firebase-id-token";

export const runtime = "nodejs";

type DispatchMineRequest = {
  idToken?: string;
};

export async function POST(request: Request) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return NextResponse.json({ error: "Missing Firebase project configuration." }, { status: 500 });
  }

  let payload: DispatchMineRequest;
  try {
    payload = (await request.json()) as DispatchMineRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload.idToken || typeof payload.idToken !== "string") {
    return NextResponse.json({ error: "Missing idToken." }, { status: 401 });
  }

  let uid: string;
  try {
    uid = await verifyFirebaseIdToken(payload.idToken, projectId);
  } catch {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  try {
    const result = await dispatchDueAlarmJobsForUser(uid);
    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dispatch failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
