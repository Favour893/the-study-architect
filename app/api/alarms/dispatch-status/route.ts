import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { readDispatchHeartbeat } from "@/lib/server/dispatch-alarms";
import { verifyFirebaseIdToken } from "@/lib/server/verify-firebase-id-token";

export const runtime = "nodejs";

type StatusRequest = {
  idToken?: string;
};

export async function POST(request: Request) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return NextResponse.json({ error: "Missing Firebase project configuration." }, { status: 500 });
  }

  let payload: StatusRequest;
  try {
    payload = (await request.json()) as StatusRequest;
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
    const db = getAdminDb();
    const [heartbeat, metaSnap, jobsSnap] = await Promise.all([
      readDispatchHeartbeat(),
      db.doc(`users/${uid}/alarmDispatch/meta`).get(),
      db.collection(`users/${uid}/alarmJobs`).where("fired", "==", false).limit(50).get(),
    ]);

    const meta = metaSnap.exists ? metaSnap.data() : undefined;
    const pendingJobs = jobsSnap.docs.filter((doc) => doc.data().cancelled !== true).length;
    const updatedAt = heartbeat?.updatedAt ? new Date(heartbeat.updatedAt).getTime() : null;
    const ageMs = updatedAt ? Date.now() - updatedAt : null;
    const dispatcherActive = ageMs !== null && ageMs < 10 * 60 * 1000;

    return NextResponse.json({
      ok: true,
      hasFcmToken: Boolean(meta?.fcmToken),
      notificationsEnabled: meta?.notificationsEnabled !== false,
      pendingJobs,
      dispatcherActive,
      dispatcherAgeMs: ageMs,
      lastDispatch: heartbeat,
      cronUrl: "https://the-study-architect.vercel.app/api/cron/dispatch-alarms",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "status_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
