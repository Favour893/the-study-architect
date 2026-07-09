import type { ScheduledAlarm } from "./types";

const CACHED_ALARMS_KEY = "tsa.alarm-schedule-cache";

export function saveCachedAlarms(alarms: ScheduledAlarm[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(CACHED_ALARMS_KEY, JSON.stringify(alarms));
  } catch {
    // Storage full or unavailable.
  }
}

export function loadCachedAlarms(): ScheduledAlarm[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(CACHED_ALARMS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (alarm): alarm is ScheduledAlarm =>
        Boolean(
          alarm &&
            typeof alarm === "object" &&
            typeof (alarm as ScheduledAlarm).id === "string" &&
            typeof (alarm as ScheduledAlarm).fireAt === "string" &&
            typeof (alarm as ScheduledAlarm).title === "string" &&
            typeof (alarm as ScheduledAlarm).body === "string",
        ),
    );
  } catch {
    return [];
  }
}
