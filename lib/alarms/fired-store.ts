const FIRED_PREFIX = "tsa.alarm-fired:";

export function firedAlarmKey(alarmId: string, fireAt: string) {
  return `${FIRED_PREFIX}${alarmId}:${fireAt}`;
}

export function hasAlarmFired(alarmId: string, fireAt: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(firedAlarmKey(alarmId, fireAt)) === "1";
}

export function markAlarmFired(alarmId: string, fireAt: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(firedAlarmKey(alarmId, fireAt), "1");
}

/** Alarm keys in the form `id:fireAt` (without the storage prefix). */
export function listFiredAlarmKeys(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(FIRED_PREFIX)) {
      keys.push(key.slice(FIRED_PREFIX.length));
    }
  }
  return keys;
}

export function mergeFiredAlarmKeys(keys: string[]) {
  if (typeof window === "undefined") {
    return;
  }
  for (const key of keys) {
    const [alarmId, ...rest] = key.split(":");
    const fireAt = rest.join(":");
    if (!alarmId || !fireAt) {
      continue;
    }
    markAlarmFired(alarmId, fireAt);
  }
}
