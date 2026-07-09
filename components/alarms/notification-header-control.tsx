"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, CheckCircle2, Smartphone } from "lucide-react";
import { notifyAlarmsChanged } from "@/lib/alarms/alarm-events";
import {
  ensureNotificationPermission,
  getNotificationPermissionState,
  sendTestNotification,
  type NotificationPermissionState,
} from "@/lib/alarms/notifications";

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInstalledPwa() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function NotificationHeaderControl() {
  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function refreshPermission() {
      setPermission(getNotificationPermissionState());
    }
    refreshPermission();
    document.addEventListener("visibilitychange", refreshPermission);
    return () => document.removeEventListener("visibilitychange", refreshPermission);
  }, []);

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handlePointer);
    }
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [open]);

  if (permission === "unsupported") {
    return null;
  }

  const needsIosInstall = isIosDevice() && !isInstalledPwa();

  async function enableNotifications() {
    if (needsIosInstall) {
      setOpen(true);
      return;
    }
    setBusy(true);
    setTestSent(false);
    try {
      const allowed = await ensureNotificationPermission();
      setPermission(getNotificationPermissionState());
      if (allowed) {
        notifyAlarmsChanged();
        await sendTestNotification();
        setTestSent(true);
        setOpen(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const ok = await sendTestNotification();
      setTestSent(ok);
    } finally {
      setBusy(false);
    }
  }

  if (permission === "default") {
    return (
      <div className="relative shrink-0" ref={wrapRef}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void enableNotifications()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60 sm:px-3 sm:text-sm"
          title={needsIosInstall ? "Install TSA to Home Screen first" : "Enable notifications for alarms"}
        >
          {needsIosInstall ? <Smartphone className="h-4 w-4 shrink-0" /> : <Bell className="h-4 w-4 shrink-0" />}
          <span className="hidden sm:inline">
            {busy ? "Checking…" : needsIosInstall ? "Install app for alerts" : "Enable notifications"}
          </span>
          <span className="sr-only sm:hidden">
            {busy ? "Checking…" : needsIosInstall ? "Install app for alerts" : "Enable notifications"}
          </span>
        </button>
        {open && needsIosInstall ? (
          <div className="absolute right-0 top-full z-50 mt-1.5 w-[min(100vw-1.5rem,18rem)] rounded-xl border border-app-border bg-panel p-3 shadow-lg">
            <p className="text-sm font-medium text-app-fg">Install TSA for iPhone alerts</p>
            <p className="mt-1 text-xs text-app-subtle">
              On iPhone, add TSA to your Home Screen first, then enable notifications from inside the installed app.
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition sm:px-3 sm:text-sm ${
          permission === "granted"
            ? "border-emerald-400/50 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
            : "border-amber-400/50 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={permission === "granted" ? "Notifications on" : "Notifications blocked"}
      >
        {permission === "granted" ? (
          <Bell className="h-4 w-4 shrink-0" />
        ) : (
          <BellOff className="h-4 w-4 shrink-0" />
        )}
        <span className="hidden sm:inline">
          {permission === "granted" ? "Notifications on" : "Notifications blocked"}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[min(100vw-1.5rem,18rem)] rounded-xl border border-app-border bg-panel p-3 shadow-lg">
          {permission === "granted" ? (
            <>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-app-fg">Phone notifications are on</p>
                  <p className="mt-1 text-xs text-app-subtle">
                    To-do, exam, and class alarms will ring on this device.
                  </p>
                  {testSent ? (
                    <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      Test notification sent.
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void sendTest()}
                className="mt-3 w-full rounded-lg border border-app-border bg-app-muted px-3 py-1.5 text-xs font-medium text-app-fg hover:bg-app-accent-soft disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send test notification"}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-app-fg">Notifications are blocked</p>
              <p className="mt-1 text-xs text-app-subtle">
                Allow notifications for this site in your browser or phone settings, then reload the app.
              </p>
              {needsIosInstall ? (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-app-subtle">
                  <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  On iPhone, add TSA to your Home Screen first.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
