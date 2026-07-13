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
  const nowMs = Date.now();

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
      cancelled: false,
      notificationsEnabled: true,
      updatedAt: serverTimestamp(),
    });
  }

  for (const snapshot of existing.docs) {
    if (nextJobIds.has(snapshot.id)) {
      continue;
    }
    const data = snapshot.data();
    const fireMs = new Date(String(data.fireAt || "")).getTime();
    const isStalePast =
      data.fired === true ||
      data.cancelled === true ||
      (!Number.isNaN(fireMs) && fireMs < nowMs - 24 * 60 * 60 * 1000);

    if (!notificationsEnabled) {
      batch.set(
        snapshot.ref,
        { notificationsEnabled: false, updatedAt: serverTimestamp() },
        { merge: true },
      );
      continue;
    }

    // Never remove future unfired jobs on sync — partial loads (todos-only, etc.)
    // previously wiped exam/class jobs and broke closed-app delivery.
    if (isStalePast) {
      batch.delete(snapshot.ref);
    }
  }

  await batch.commit();
}

/** Re-enable every unfired job after the user turns notifications back on. */
export async function reenableAlarmJobs(uid: string) {
  const db = getDb();
  const snapshot = await getDocs(collection(db, alarmJobsPath(uid)));
  const batch = writeBatch(db);
  let ops = 0;
  for (const job of snapshot.docs) {
    const data = job.data();
    if (data.fired === true) {
      continue;
    }
    batch.set(
      job.ref,
      {
        notificationsEnabled: true,
        cancelled: false,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    ops += 1;
  }
  if (ops > 0) {
    await batch.commit();
  }
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
