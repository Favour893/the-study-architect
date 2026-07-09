"use client";

import { useEffect } from "react";
import { notifyAlarmsChanged } from "@/lib/alarms/alarm-events";
import { registerBackgroundAlarmWake } from "@/lib/alarms/scheduler";
import { canUseNotifications } from "@/lib/alarms/notifications";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let retryTimer: number | null = null;

    async function registerServiceWorker() {
      try {
        await navigator.serviceWorker.register("/sw.js");
        notifyAlarmsChanged();
        if (canUseNotifications()) {
          await registerBackgroundAlarmWake();
        }
      } catch (error) {
        console.error("Service worker registration failed:", error);
        if (retryTimer === null) {
          retryTimer = window.setTimeout(() => {
            retryTimer = null;
            void registerServiceWorker();
          }, 5000);
        }
      }
    }

    void registerServiceWorker();

    return () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, []);

  return null;
}
