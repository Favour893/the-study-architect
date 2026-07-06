import { markAlarmFired } from "./fired-store";
import { playAlarmSound } from "./play-alarm-sound";
import type { ScheduledAlarm } from "./types";

export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "granted") {
    return true;
  }
  if (Notification.permission === "denied") {
    return false;
  }
  return (await Notification.requestPermission()) === "granted";
}

export function canUseNotifications() {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
}

async function showViaServiceWorker(alarm: ScheduledAlarm): Promise<boolean> {
  if (!("serviceWorker" in navigator)) {
    return false;
  }
  const registration = await navigator.serviceWorker.ready;
  const target = registration.active ?? registration.waiting ?? registration.installing;
  if (!target) {
    return false;
  }
  target.postMessage({ type: "SHOW_ALARM", alarm });
  return true;
}

export async function deliverAlarm(alarm: ScheduledAlarm) {
  if (!canUseNotifications()) {
    return;
  }

  void playAlarmSound();

  const usedWorker = await showViaServiceWorker(alarm);
  if (!usedWorker) {
    new Notification(alarm.title, {
      body: alarm.body,
      tag: `${alarm.id}:${alarm.fireAt}`,
      silent: false,
      requireInteraction: true,
    });
  }

  markAlarmFired(alarm.id, alarm.fireAt);
}
