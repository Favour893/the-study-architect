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

async function sendAlarmPush(fcmToken: string, job: AlarmJob) {
  const alarmKey = `${job.alarmId}:${job.fireAt}`;
  // Ensure Admin app is initialized before messaging.
  getAdminDb();
  await getMessaging().send({
    token: fcmToken,
    data: {
      alarmId: String(job.alarmId),
      fireAt: String(job.fireAt),
      title: String(job.title),
      body: String(job.body ?? ""),
      href: String(job.href || "/dashboard"),
      alarmKey: String(alarmKey),
    },
    webpush: {
      headers: {
        Urgency: "high",
        TTL: "120",
      },
    },
  });
}

async function loadDueAlarmJobDocs() {
  const db = getAdminDb();
  try {
    const snapshot = await db.collectionGroup("alarmJobs").where("fired", "==", false).limit(250).get();
    return snapshot.docs;
  } catch {
    // Collection-group index may be missing/building — fall back to per-user queries.
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
    return docs.slice(0, 250);
  }
}

async function dispatchJobDocs(jobDocs: QueryDocumentSnapshot[], nowIso: string) {
  const db = getAdminDb();
  let checked = 0;
  let sent = 0;
  let skipped = 0;
  let due = 0;
  const errors: string[] = [];

  for (const jobDoc of jobDocs) {
    checked += 1;
    const job = jobDoc.data() as AlarmJob;
    if (!job.notificationsEnabled || !job.alarmId || !job.fireAt || !job.title) {
      skipped += 1;
      continue;
    }
    if (job.fireAt > nowIso) {
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

  return { checked, due, sent, skipped, errors };
}

export async function dispatchDueAlarmJobs(nowIso = new Date().toISOString()) {
  const docs = await loadDueAlarmJobDocs();
  return dispatchJobDocs(docs, nowIso);
}

export async function dispatchDueAlarmJobsForUser(uid: string, nowIso = new Date().toISOString()) {
  const db = getAdminDb();
  const snapshot = await db.collection(`users/${uid}/alarmJobs`).where("fired", "==", false).limit(50).get();
  return dispatchJobDocs(snapshot.docs, nowIso);
}
