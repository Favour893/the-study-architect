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
  await getMessaging().send({
    token: fcmToken,
    data: {
      alarmId: job.alarmId,
      fireAt: job.fireAt,
      title: job.title,
      body: job.body,
      href: job.href || "/dashboard",
      alarmKey,
    },
    webpush: {
      headers: {
        Urgency: "high",
      },
    },
  });
}

async function dispatchJobDocs(jobDocs: QueryDocumentSnapshot[], nowIso: string) {
  const db = getAdminDb();
  let checked = 0;
  let sent = 0;
  let skipped = 0;

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

    const uid = jobDoc.ref.parent.parent?.id;
    if (!uid) {
      skipped += 1;
      continue;
    }

    const meta = await db.doc(`users/${uid}/alarmDispatch/meta`).get();
    const fcmToken = meta.exists ? (meta.data()?.fcmToken as string | undefined) : undefined;
    if (!fcmToken) {
      skipped += 1;
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
    } catch {
      skipped += 1;
    }
  }

  return { checked, sent, skipped };
}

export async function dispatchDueAlarmJobs(nowIso = new Date().toISOString()) {
  const db = getAdminDb();
  const snapshot = await db.collectionGroup("alarmJobs").where("fired", "==", false).limit(250).get();
  return dispatchJobDocs(snapshot.docs, nowIso);
}

export async function dispatchDueAlarmJobsForUser(uid: string, nowIso = new Date().toISOString()) {
  const db = getAdminDb();
  const snapshot = await db.collection(`users/${uid}/alarmJobs`).where("fired", "==", false).limit(50).get();
  return dispatchJobDocs(snapshot.docs, nowIso);
}
