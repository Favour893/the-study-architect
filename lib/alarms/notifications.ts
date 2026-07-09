import { hasAlarmFired, markAlarmFired } from "./fired-store";
import { areAppNotificationsEnabled } from "./notification-preference";
import { playAlarmSound, stopAlarmSound } from "./play-alarm-sound";
import type { ScheduledAlarm } from "./types";
const inFlightDeliveries = new Set<string>();

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

export function hasNotificationPermission() {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
}

export function canUseNotifications() {
  return hasNotificationPermission() && areAppNotificationsEnabled();
}

export type NotificationPermissionState = "unsupported" | "granted" | "denied" | "default";

export function getNotificationPermissionState(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

function pulseAlarmSound() {
  void playAlarmSound();
  const timers = [
    window.setTimeout(() => void playAlarmSound(), 4000),
    window.setTimeout(() => void playAlarmSound(), 8000),
    window.setTimeout(() => void playAlarmSound(), 12000),
    window.setTimeout(() => void playAlarmSound(), 16000),
  ];
  return () => {
    for (const timer of timers) {
      window.clearTimeout(timer);
    }
    stopAlarmSound();
  };
}

async function showViaServiceWorker(alarm: ScheduledAlarm): Promise<boolean> {
  if (!("serviceWorker" in navigator)) {
    return false;
  }
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500)),
  ]);
  if (!registration) {
    return false;
  }
  const target = registration.active ?? registration.waiting ?? registration.installing;
  if (!target) {
    return false;
  }

  const channel = new MessageChannel();
  const acknowledged = new Promise<boolean>((resolve) => {
    const timeoutId = window.setTimeout(() => resolve(false), 3000);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeoutId);
      resolve(event.data?.ok === true);
    };
  });
  target.postMessage({ type: "SHOW_ALARM", alarm }, [channel.port2]);
  return acknowledged;
}

export async function deliverAlarm(alarm: ScheduledAlarm) {
  const key = `${alarm.id}:${alarm.fireAt}`;
  if (inFlightDeliveries.has(key)) {
    return;
  }
  if (hasAlarmFired(alarm.id, alarm.fireAt)) {
    return;
  }
  if (!canUseNotifications()) {
    return;
  }
  inFlightDeliveries.add(key);

  try {
    const stopPulse = pulseAlarmSound();

    const usedWorker = await showViaServiceWorker(alarm);
    if (usedWorker) {
      stopPulse();
      return;
    }

    new Notification(alarm.title, {
      body: alarm.body,
      tag: `${alarm.id}:${alarm.fireAt}`,
      icon: "/logo-mark.png",
      silent: false,
      requireInteraction: true,
    });
    stopPulse();
    markAlarmFired(alarm.id, alarm.fireAt);
  } finally {
    inFlightDeliveries.delete(key);
  }
}

export async function sendTestNotification(): Promise<boolean> {
  const allowed = await ensureNotificationPermission();
  if (!allowed || !canUseNotifications()) {
    return false;
  }

  const testAlarm: ScheduledAlarm = {
    id: "test",
    fireAt: new Date().toISOString(),
    title: "TSA alarms are on",
    body: "You will get reminders for to-dos, exams, and classes on this device.",
    href: "/dashboard",
  };

  pulseAlarmSound();

  const usedWorker = await showViaServiceWorker(testAlarm);
  if (!usedWorker) {
    new Notification(testAlarm.title, {
      body: testAlarm.body,
      tag: "tsa:test-notification",
      icon: "/logo-mark.png",
      silent: false,
      requireInteraction: true,
    });
  }

  return true;
}
