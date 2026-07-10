import { NextResponse } from "next/server";
import { getMessaging } from "firebase-admin/messaging";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { verifyFirebaseIdToken } from "@/lib/server/verify-firebase-id-token";

export const runtime = "nodejs";

type TestPushRequest = {
  idToken?: string;
};

function appOrigin(request: Request) {
  const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (envOrigin) {
    return envOrigin;
  }
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return NextResponse.json({ error: "Missing Firebase project configuration." }, { status: 500 });
  }

  let payload: TestPushRequest;
  try {
    payload = (await request.json()) as TestPushRequest;
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
    const meta = await db.doc(`users/${uid}/alarmDispatch/meta`).get();
    const fcmToken = meta.exists ? (meta.data()?.fcmToken as string | undefined) : undefined;
    if (!fcmToken) {
      return NextResponse.json(
        {
          ok: false,
          error: "missing_fcm_token",
          hint: "Enable notifications on this device, wait a few seconds, then try again.",
        },
        { status: 400 },
      );
    }

    const origin = appOrigin(request);
    const title = "TSA background push works";
    const body =
      "Close the PWA fully — this was delivered by FCM to your service worker.";
    const alarmKey = `test-push:${Date.now()}`;

    await getMessaging().send({
      token: fcmToken,
      data: {
        alarmId: "test-push",
        fireAt: new Date().toISOString(),
        title,
        body,
        href: "/dashboard",
        alarmKey,
      },
      webpush: {
        headers: {
          Urgency: "high",
          TTL: "120",
        },
        fcmOptions: {
          link: `${origin}/dashboard`,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      uid,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "send_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
