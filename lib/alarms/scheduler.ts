import { saveCachedAlarms } from "./alarm-cache";
import { persistAlarmSchedule } from "./alarm-persist";
import { hasAlarmFired, listFiredAlarmKeys, mergeFiredAlarmKeys } from "./fired-store";
import { scheduleOsNotifications } from "./os-notification-schedule";
import { areAppNotificationsEnabled } from "./notification-preference";
import { deliverAlarm, hasNotificationPermission } from "./notifications";
import type { ScheduledAlarm } from "./types";
import { ALARM_CHECK_INTERVAL_MS } from "./types";
const MAX_SET_TIMEOUT_MS = 2147483647;

type BackgroundSyncRegistration = ServiceWorkerRegistration & {
  sync?: { register: (tag: string) => Promise<void> };
  periodicSync?: { register: (tag: string, options: { minInterval: number }) => Promise<void> };
};

export function findDueAlarms(alarms: ScheduledAlarm[], nowMs = Date.now()): ScheduledAlarm[] {
  return alarms.filter((alarm) => {
    const fireAtMs = new Date(alarm.fireAt).getTime();
    if (Number.isNaN(fireAtMs) || fireAtMs > nowMs) {
      return false;
    }
    return !hasAlarmFired(alarm.id, alarm.fireAt);
  });
}

export function scheduleAlarmTimers(
  alarms: ScheduledAlarm[],
  onFire: (alarm: ScheduledAlarm) => void,
  nowMs = Date.now(),
): () => void {
  const timers: number[] = [];

  for (const alarm of alarms) {
    if (hasAlarmFired(alarm.id, alarm.fireAt)) {
      continue;
    }
    const fireAtMs = new Date(alarm.fireAt).getTime();
    if (Number.isNaN(fireAtMs)) {
      continue;
    }
    const delay = fireAtMs - nowMs;
    if (delay <= 0) {
      continue;
    }
    const safeDelay = Math.min(delay, MAX_SET_TIMEOUT_MS);
    timers.push(
      window.setTimeout(() => {
        onFire(alarm);
      }, safeDelay),
    );
  }

  return () => {
    for (const timer of timers) {
      window.clearTimeout(timer);
    }
  };
}

export async function registerBackgroundAlarmWake() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  try {
    const registration = (await navigator.serviceWorker.ready) as BackgroundSyncRegistration;
    if (registration.sync) {
      try {
        await registration.sync.register("alarm-sync");
      } catch {
        // Unsupported or quota exceeded.
      }
    }
    if (registration.periodicSync) {
      try {
        await registration.periodicSync.register("alarm-check", {
          minInterval: 12 * 60 * 60 * 1000,
        });
      } catch {
        // Requires installed PWA and permission on supported browsers.
      }
    }
  } catch {
    // Service worker not ready.
  }
}

function notificationsEnabledForSync() {
  return hasNotificationPermission() && areAppNotificationsEnabled();
}

async function postSyncToServiceWorker(
  alarms: ScheduledAlarm[],
  notificationsEnabled: boolean,
): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  const target = registration.active ?? registration.waiting ?? registration.installing;
  if (!target) {
    return;
  }

  const firedKeys = listFiredAlarmKeys();
  const channel = new MessageChannel();
  const acknowledged = new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(() => resolve(), 2500);
    channel.port1.onmessage = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
  });

  target.postMessage(
    {
      type: "SYNC_ALARMS",
      alarms,
      firedKeys,
      notificationsEnabled,
    },
    [channel.port2],
  );
  await acknowledged;
}

export async function flushAlarmScheduleToServiceWorker(alarms: ScheduledAlarm[]) {
  const notificationsEnabled = notificationsEnabledForSync();
  const scheduledAlarms = notificationsEnabled ? alarms : [];
  const firedKeys = listFiredAlarmKeys();

  saveCachedAlarms(scheduledAlarms);

  await persistAlarmSchedule({
    pendingAlarms: scheduledAlarms,
    firedAlarmKeys: firedKeys,
    notificationsEnabled,
  });

  await postSyncToServiceWorker(scheduledAlarms, notificationsEnabled);
  await scheduleOsNotifications(scheduledAlarms, new Set(firedKeys));
  if (notificationsEnabled) {
    await registerBackgroundAlarmWake();
  }
}

export async function syncAlarmsToServiceWorker(alarms: ScheduledAlarm[]) {
  await flushAlarmScheduleToServiceWorker(alarms);
}

export function runAlarmSweep(alarms: ScheduledAlarm[]) {
  return (async () => {
    for (const alarm of findDueAlarms(alarms)) {
      await deliverAlarm(alarm);
    }
  })();
}

export async function mergeFiredKeysFromServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  const target = registration.active ?? registration.waiting ?? registration.installing;
  if (!target) {
    return;
  }
  const channel = new MessageChannel();
  const responsePromise = new Promise<string[]>((resolve) => {
    const timeoutId = window.setTimeout(() => resolve([]), 1500);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeoutId);
      const keys = Array.isArray(event.data?.firedKeys)
        ? event.data.firedKeys.filter((key: unknown): key is string => typeof key === "string")
        : [];
      resolve(keys);
    };
  });
  target.postMessage({ type: "GET_FIRED_KEYS" }, [channel.port2]);
  const firedKeys = await responsePromise;
  if (firedKeys.length > 0) {
    mergeFiredAlarmKeys(firedKeys);
  }
}

export { ALARM_CHECK_INTERVAL_MS };
