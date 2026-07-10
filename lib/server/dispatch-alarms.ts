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

async function sendAlarmPush(fcmToken: string, job: AlarmJob) {
  const alarmKey = `${job.alarmId}:${job.fireAt}`;
  const title = String(job.title || "Reminder");
  const body = `${String(job.body ?? "")}\n\nTap or swipe away to turn off.`.trim();
  getAdminDb();
  await getMessaging().send({
    token: fcmToken,
    // Notification payload helps Android/Chrome wake and display when closed.
    notification: {
      title,
      body,
    },
    data: {
      alarmId: String(job.alarmId),
      fireAt: String(job.fireAt),
      title,
      body: String(job.body ?? ""),
      href: String(job.href || "/dashboard"),
      alarmKey: String(alarmKey),
    },
    webpush: {
      headers: {
        Urgency: "high",
        TTL: "300",
      },
      notification: {
        title,
        body,
        icon: "/logo-mark.png",
        badge: "/logo-mark.png",
        tag: alarmKey,
        requireInteraction: true,
        silent: false,
      },
      fcmOptions: {
        link: "/",
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
    if (!job.notificationsEnabled || !job.alarmId || !job.fireAt || !job.title) {
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
    const fcmToken = meta.exists ? (meta.data()?.fcmToken as string | undefined) : undefined;
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

export async function dispatchDueAlarmJobs(nowIso = new Date().toISOString()) {
  const loaded = await loadDueAlarmJobDocs();
  const result = await dispatchJobDocs(loaded.docs, nowIso);
  return {
    ...result,
    source: loaded.source,
    fallbackError: "fallbackError" in loaded ? loaded.fallbackError : undefined,
  };
}

export async function dispatchDueAlarmJobsForUser(uid: string, nowIso = new Date().toISOString()) {
  const db = getAdminDb();
  const snapshot = await db.collection(`users/${uid}/alarmJobs`).where("fired", "==", false).limit(50).get();
  return dispatchJobDocs(snapshot.docs, nowIso);
}
