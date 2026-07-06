import { hasAlarmFired } from "./fired-store";
import { deliverAlarm } from "./notifications";
import type { ScheduledAlarm } from "./types";
import { ALARM_CHECK_INTERVAL_MS } from "./types";

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
      onFire(alarm);
      continue;
    }
    timers.push(
      window.setTimeout(() => {
        onFire(alarm);
      }, delay),
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
  target.postMessage({ type: "SYNC_ALARMS", alarms });
}

export function runAlarmSweep(alarms: ScheduledAlarm[]) {
  for (const alarm of findDueAlarms(alarms)) {
    void deliverAlarm(alarm);
  }
}

export { ALARM_CHECK_INTERVAL_MS };
