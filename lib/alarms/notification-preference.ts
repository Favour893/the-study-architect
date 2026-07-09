import { notifyAlarmsChanged } from "./alarm-events";

export const NOTIFICATIONS_ENABLED_KEY = "tsa.notifications.enabled";

export function areAppNotificationsEnabled() {
  if (typeof window === "undefined") {
    return true;
  }
  return window.localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) !== "false";
}

export function setAppNotificationsEnabled(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? "true" : "false");
  notifyAlarmsChanged();
}
