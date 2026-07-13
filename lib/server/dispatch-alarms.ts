import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAdminDb } from "./firebase-admin";

type AlarmJob = {
  alarmId: string;
  fireAt: string;
  title: string;
  body: string;
  href?: string;
  fired?: boolean;
  cancelled?: boolean;
  notificationsEnabled?: boolean;
};

function isDue(fireAt: string, nowIso: string) {
  const fireMs = new Date(fireAt).getTime();
  const nowMs = new Date(nowIso).getTime();
  if (Number.isNaN(fireMs) || Number.isNaN(nowMs)) {
    return fireAt <= nowIso;
  }
  // Allow a small clock skew window.
  return fireMs <= nowMs + 15_000;
}

function appOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://the-study-architect.vercel.app").replace(/\/$/, "");
}

async function sendAlarmPush(fcmToken: string, job: AlarmJob) {
  const alarmKey = `${job.alarmId}:${job.fireAt}`;
  const title = String(job.title || "Reminder");
  const body = `${String(job.body ?? "")}\n\nTap or swipe away to turn off.`.trim();
  const origin = appOrigin();
  const icon = `${origin}/logo-mark.png`;
  const href = String(job.href || "/dashboard");
  const link = href.startsWith("http") ? href : `${origin}${href.startsWith("/") ? href : `/${href}`}`;
  getAdminDb();
  // Include a notification payload so Android/Chrome can display even if the SW handler fails.
  // Data payload lets the SW deep-link / play the in-app chime when a client is open.
  await getMessaging().send({
    token: fcmToken,
    notification: {
      title,
      body,
    },
    data: {
      alarmId: String(job.alarmId),
      fireAt: String(job.fireAt),
      title,
      body: String(job.body ?? ""),
      href,
      alarmKey: String(alarmKey),
    },
    webpush: {
      headers: {
        Urgency: "high",
        TTL: "86400",
      },
      notification: {
        title,
        body,
        icon,
        badge: icon,
        tag: alarmKey,
        requireInteraction: true,
        silent: false,
      },
      fcmOptions: {
        link,
      },
    },
  });
}

async function loadDueAlarmJobDocs() {
  const db = getAdminDb();
  try {
    const snapshot = await db.collectionGroup("alarmJobs").where("fired", "==", false).limit(250).get();
    return { docs: snapshot.docs, source: "collectionGroup" as const };
  } catch (error) {
    const users = await db.collection("users").limit(200).get();
    const docs: QueryDocumentSnapshot[] = [];
    for (const userDoc of users.docs) {
      const jobs = await db
        .collection(`users/${userDoc.id}/alarmJobs`)
        .where("fired", "==", false)
        .limit(50)
        .get();
      docs.push(...jobs.docs);
      if (docs.length >= 250) {
        break;
      }
    }
    return {
      docs: docs.slice(0, 250),
      source: "perUserFallback" as const,
      fallbackError: error instanceof Error ? error.message : "collection_group_failed",
    };
  }
}

async function dispatchJobDocs(jobDocs: QueryDocumentSnapshot[], nowIso: string) {
  const db = getAdminDb();
  let checked = 0;
  let sent = 0;
  let skipped = 0;
  let due = 0;
  let waiting = 0;
  const errors: string[] = [];

  for (const jobDoc of jobDocs) {
    checked += 1;
    const job = jobDoc.data() as AlarmJob;
    if (!job.alarmId || !job.fireAt || !job.title || job.cancelled === true) {
      skipped += 1;
      continue;
    }
    if (!isDue(job.fireAt, nowIso)) {
      waiting += 1;
      continue;
    }
    due += 1;

    const uid = jobDoc.ref.parent.parent?.id;
    if (!uid) {
      skipped += 1;
      continue;
    }

    const meta = await db.doc(`users/${uid}/alarmDispatch/meta`).get();
    const metaData = meta.exists ? meta.data() : undefined;
    const fcmToken = metaData?.fcmToken as string | undefined;
    // Meta is the only enable switch — ignore stale per-job notificationsEnabled flags.
    if (metaData?.notificationsEnabled === false) {
      skipped += 1;
      continue;
    }
    if (!fcmToken) {
      skipped += 1;
      if (errors.length < 5) {
        errors.push(`missing_fcm_token:${uid}`);
      }
      continue;
    }

    try {
      await sendAlarmPush(fcmToken, job);
      await jobDoc.ref.set(
        {
          fired: true,
          deliveredAt: new Date().toISOString(),
        },
        { merge: true },
      );
      sent += 1;
    } catch (error) {
      skipped += 1;
      if (errors.length < 5) {
        const message = error instanceof Error ? error.message : "send_failed";
        errors.push(`send_failed:${uid}:${message}`);
      }
    }
  }

  return { checked, due, waiting, sent, skipped, errors };
}

export async function writeDispatchHeartbeat(result: Record<string, unknown>) {
  const db = getAdminDb();
  await db.doc("system/alarmDispatchHeartbeat").set(
    {
      ...result,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function readDispatchHeartbeat() {
  const db = getAdminDb();
  const snap = await db.doc("system/alarmDispatchHeartbeat").get();
  if (!snap.exists) {
    return null;
  }
  return snap.data() as {
    updatedAt?: string;
    sent?: number;
    due?: number;
    waiting?: number;
    checked?: number;
    ok?: boolean;
  };
}

export async function dispatchDueAlarmJobs(nowIso = new Date().toISOString()) {
  const loaded = await loadDueAlarmJobDocs();
  const result = await dispatchJobDocs(loaded.docs, nowIso);
  const payload = {
    ...result,
    ok: true,
    source: loaded.source,
    fallbackError: "fallbackError" in loaded ? loaded.fallbackError : undefined,
  };
  try {
    await writeDispatchHeartbeat(payload);
  } catch {
    // Heartbeat is best-effort diagnostics.
  }
  return payload;
}

export async function dispatchDueAlarmJobsForUser(uid: string, nowIso = new Date().toISOString()) {
  const db = getAdminDb();
  const snapshot = await db.collection(`users/${uid}/alarmJobs`).where("fired", "==", false).limit(50).get();
  return dispatchJobDocs(snapshot.docs, nowIso);
}
