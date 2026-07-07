export const ALARMS_CHANGED_EVENT = "tsa:alarms-changed";

export function notifyAlarmsChanged() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(ALARMS_CHANGED_EVENT));
}
