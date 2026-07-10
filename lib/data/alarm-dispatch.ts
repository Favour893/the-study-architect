import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { listFiredAlarmKeys, mergeFiredAlarmKeys } from "@/lib/alarms/fired-store";
import { areAppNotificationsEnabled } from "@/lib/alarms/notification-preference";
import type { ScheduledAlarm } from "@/lib/alarms/types";
import { hasNotificationPermission } from "@/lib/alarms/notifications";
import { getDb } from "../firebase/db";

function alarmJobId(alarm: ScheduledAlarm) {
  return `${alarm.id}__${alarm.fireAt}`.replace(/[/:]/g, "_");
}

function alarmJobsPath(uid: string) {
  return `users/${uid}/alarmJobs`;
}

function alarmDispatchMetaPath(uid: string) {
  return `users/${uid}/alarmDispatch/meta`;
}

export async function saveAlarmDispatchMeta(
  uid: string,
  options: { fcmToken?: string | null; notificationsEnabled?: boolean },
) {
  const db = getDb();
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (typeof options.notificationsEnabled === "boolean") {
    payload.notificationsEnabled = options.notificationsEnabled;
  }
  if (options.fcmToken) {
    payload.fcmToken = options.fcmToken;
  }
  await setDoc(doc(db, alarmDispatchMetaPath(uid)), payload, { merge: true });
}

export async function syncAlarmDispatch(
  uid: string,
  alarms: ScheduledAlarm[],
  fcmToken: string | null,
) {
  const db = getDb();
  const notificationsEnabled = hasNotificationPermission() && areAppNotificationsEnabled();
  const firedKeys = new Set(listFiredAlarmKeys());
  const scheduledAlarms = notificationsEnabled ? alarms : [];

  await saveAlarmDispatchMeta(uid, { fcmToken, notificationsEnabled });

  const jobsRef = collection(db, alarmJobsPath(uid));
  const existing = await getDocs(jobsRef);
  const nextJobIds = new Set(scheduledAlarms.map(alarmJobId));
  const batch = writeBatch(db);

  for (const alarm of scheduledAlarms) {
    const key = `${alarm.id}:${alarm.fireAt}`;
    if (firedKeys.has(key)) {
      continue;
    }
    batch.set(doc(db, alarmJobsPath(uid), alarmJobId(alarm)), {
      alarmId: alarm.id,
      fireAt: alarm.fireAt,
      title: alarm.title,
      body: alarm.body,
      href: alarm.href || "/dashboard",
      fired: false,
      notificationsEnabled,
      updatedAt: serverTimestamp(),
    });
  }

  for (const snapshot of existing.docs) {
    if (!nextJobIds.has(snapshot.id)) {
      batch.delete(snapshot.ref);
    }
  }

  await batch.commit();
}

export async function mergeFiredKeysFromAlarmJobs(uid: string) {
  const db = getDb();
  const snapshot = await getDocs(collection(db, alarmJobsPath(uid)));
  const firedKeys: string[] = [];

  for (const job of snapshot.docs) {
    const data = job.data();
    if (data.fired === true && data.alarmId && data.fireAt) {
      firedKeys.push(`${data.alarmId}:${data.fireAt}`);
    }
  }

  if (firedKeys.length > 0) {
    mergeFiredAlarmKeys(firedKeys);
  }
}

export async function markAlarmJobDismissed(uid: string, alarmId: string, fireAt: string) {
  const db = getDb();
  const jobRef = doc(db, alarmJobsPath(uid), alarmJobId({ id: alarmId, fireAt } as ScheduledAlarm));
  try {
    await setDoc(
      jobRef,
      {
        fired: true,
        dismissedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch {
    // Non-fatal if the job doc was already removed.
  }
}
