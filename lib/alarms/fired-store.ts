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
