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

export async function dispatchDueAlarmJobs(nowIso = new Date().toISOString()) {
  const db = getAdminDb();
  const snapshot = await db.collectionGroup("alarmJobs").where("fired", "==", false).limit(250).get();

  let checked = 0;
  let sent = 0;
  let skipped = 0;

  for (const jobDoc of snapshot.docs) {
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

    const alarmKey = `${job.alarmId}:${job.fireAt}`;
    try {
      await getMessaging().send({
        token: fcmToken,
        notification: {
          title: job.title,
          body: `${job.body}\n\nTap or swipe away to turn off.`,
        },
        data: {
          alarmId: job.alarmId,
          fireAt: job.fireAt,
          href: job.href || "/dashboard",
          alarmKey,
        },
        webpush: {
          headers: {
            Urgency: "high",
          },
          notification: {
            tag: alarmKey,
            requireInteraction: true,
            icon: "/logo-mark.png",
          },
        },
      });
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
