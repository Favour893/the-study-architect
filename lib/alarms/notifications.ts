import { hasAlarmFired, markAlarmFired } from "./fired-store";
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

export type NotificationPermissionState = "unsupported" | "granted" | "denied" | "default";

export function getNotificationPermissionState(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
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
  if (hasAlarmFired(alarm.id, alarm.fireAt)) {
    return;
  }
  if (!canUseNotifications()) {
    return;
  }
  markAlarmFired(alarm.id, alarm.fireAt);

  void playAlarmSound();

  const usedWorker = await showViaServiceWorker(alarm);
  if (!usedWorker) {
    new Notification(alarm.title, {
      body: alarm.body,
      tag: `${alarm.id}:${alarm.fireAt}`,
      icon: "/logo-mark.png",
      silent: false,
      requireInteraction: true,
    });
  }

}

export async function sendTestNotification(): Promise<boolean> {
  const allowed = await ensureNotificationPermission();
  if (!allowed) {
    return false;
  }

  const testAlarm: ScheduledAlarm = {
    id: "test",
    fireAt: new Date().toISOString(),
    title: "TSA alarms are on",
    body: "You will get reminders for to-dos, exams, and classes on this device.",
    href: "/dashboard",
  };

  const usedWorker = await showViaServiceWorker(testAlarm);
  if (!usedWorker) {
    new Notification(testAlarm.title, {
      body: testAlarm.body,
      tag: "tsa:test-notification",
      icon: "/logo-mark.png",
      silent: false,
    });
  }

  return true;
}
