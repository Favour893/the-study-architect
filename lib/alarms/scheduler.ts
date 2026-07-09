import { hasAlarmFired, listFiredAlarmKeys, mergeFiredAlarmKeys } from "./fired-store";
import { deliverAlarm } from "./notifications";
import type { ScheduledAlarm } from "./types";
import { ALARM_CHECK_INTERVAL_MS } from "./types";
const MAX_SET_TIMEOUT_MS = 2147483647;

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

export async function syncAlarmsToServiceWorker(alarms: ScheduledAlarm[]) {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  const target = registration.active ?? registration.waiting ?? registration.installing;
  if (!target) {
    return;
  }
  target.postMessage({
    type: "SYNC_ALARMS",
    alarms,
    firedKeys: listFiredAlarmKeys(),
  });
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
