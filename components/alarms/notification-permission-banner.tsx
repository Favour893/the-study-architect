"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Smartphone } from "lucide-react";
import {
  ensureNotificationPermission,
  getNotificationPermissionState,
  sendTestNotification,
} from "@/lib/alarms/notifications";

const DISMISS_KEY = "tsa.notifications-banner-dismissed";

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInstalledPwa() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

type NotificationPermissionBannerProps = {
  hasScheduledAlarms: boolean;
};

export function NotificationPermissionBanner({ hasScheduledAlarms }: NotificationPermissionBannerProps) {
  const [permission, setPermission] = useState(getNotificationPermissionState);
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "true",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function refreshPermission() {
      setPermission(getNotificationPermissionState());
    }
    refreshPermission();
    document.addEventListener("visibilitychange", refreshPermission);
    return () => document.removeEventListener("visibilitychange", refreshPermission);
  }, []);

  if (dismissed || permission === "granted" || permission === "unsupported") {
    return null;
  }

  if (!hasScheduledAlarms && permission !== "denied") {
    return null;
  }

  const needsIosInstall = isIosDevice() && !isInstalledPwa();

  async function enableNotifications() {
    setBusy(true);
    try {
      const allowed = await ensureNotificationPermission();
      setPermission(getNotificationPermissionState());
      if (allowed) {
        await sendTestNotification();
      }
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  }

  return (
    <div className="rounded-xl border border-amber-300/70 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
          {permission === "denied" ? (
            <BellOff className="h-4 w-4 text-amber-700 dark:text-amber-300" />
          ) : (
            <Bell className="h-4 w-4 text-amber-700 dark:text-amber-300" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-app-fg">
            {permission === "denied" ? "Notifications are blocked" : "Turn on phone alarms"}
          </p>
          <p className="mt-1 text-sm text-app-subtle">
            {permission === "denied"
              ? "Allow notifications for this site in your browser or phone settings so exam and to-do alarms can ring."
              : "Allow notifications on this device so reminders from Pulse and your course alarms can reach your phone."}
          </p>
          {needsIosInstall ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-app-subtle">
              <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              On iPhone, tap Share → Add to Home Screen first. Alarms only ring from the installed app.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {permission === "default" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void enableNotifications()}
                className="rounded-lg bg-app-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                {busy ? "Checking…" : "Enable notifications"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-app-subtle hover:text-app-fg"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
