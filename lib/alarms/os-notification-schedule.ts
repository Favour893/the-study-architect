import type { ScheduledAlarm } from "./types";

function alarmKey(alarm: ScheduledAlarm) {
  return `${alarm.id}:${alarm.fireAt}`;
}

function notificationData(alarm: ScheduledAlarm, key: string) {
  return {
    href: alarm.href || "/dashboard",
    alarmId: alarm.id,
    fireAt: alarm.fireAt,
    alarmKey: key,
  };
}

export function supportsOsNotificationTriggers() {
  return typeof window !== "undefined" && "TimestampTrigger" in window;
}

export async function scheduleOsNotifications(alarms: ScheduledAlarm[], firedKeys: Set<string>) {
  if (!supportsOsNotificationTriggers() || !("serviceWorker" in navigator)) {
    return false;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }

  const TimestampTriggerCtor = (
    window as unknown as Window & { TimestampTrigger: new (timestamp: number) => unknown }
  ).TimestampTrigger;

  const registration = await navigator.serviceWorker.ready;
  const now = Date.now();
  let scheduled = 0;

  const existing = await registration.getNotifications();
  for (const notification of existing) {
    const tag = notification.tag || "";
    if (tag && !firedKeys.has(tag)) {
      notification.close();
    }
  }

  for (const alarm of alarms) {
    const key = alarmKey(alarm);
    if (firedKeys.has(key)) {
      continue;
    }
    const due = new Date(alarm.fireAt).getTime();
    if (Number.isNaN(due) || due <= now) {
      continue;
    }

    try {
      await registration.showNotification(alarm.title, {
        body: `${alarm.body}\n\nTap or swipe away to turn off.`,
        tag: key,
        icon: "/logo-mark.png",
        badge: "/logo-mark.png",
        silent: false,
        requireInteraction: true,
        data: notificationData(alarm, key),
        // @ts-expect-error TimestampTrigger is experimental.
        showTrigger: new TimestampTriggerCtor(due),
      });
      scheduled += 1;
    } catch {
      // Browser may not support scheduled local notifications.
    }
  }

  return scheduled > 0;
}
