"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import {
  RECENT_ALERT_EVENT,
  clearRecentAlert,
  loadRecentAlert,
  markRecentAlertShown,
  saveRecentAlert,
  wasRecentAlertShown,
  type RecentAlert,
} from "@/lib/alarms/alert-deep-link";
import { readLastFiredAlert } from "@/lib/alarms/alarm-persist";

const AUTO_HIDE_MS = 12_000;

export function RecentAlertBanner() {
  const router = useRouter();
  const [alert, setAlert] = useState<RecentAlert | null>(null);

  useEffect(() => {
    let cancelled = false;
    let hideTimer: number | null = null;

    function show(next: RecentAlert | null) {
      if (!next) {
        setAlert(null);
        return;
      }
      if (wasRecentAlertShown(next.alarmId, next.fireAt)) {
        return;
      }
      setAlert(next);
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
      hideTimer = window.setTimeout(() => {
        setAlert((current) => {
          if (current && current.alarmId === next.alarmId && current.fireAt === next.fireAt) {
            markRecentAlertShown(current.alarmId, current.fireAt);
            return null;
          }
          return current;
        });
      }, AUTO_HIDE_MS);
    }

    async function hydrate() {
      const fromStorage = loadRecentAlert();
      if (fromStorage && !wasRecentAlertShown(fromStorage.alarmId, fromStorage.fireAt)) {
        if (!cancelled) {
          show(fromStorage);
        }
        return;
      }
      const fromIdb = await readLastFiredAlert();
      if (cancelled || !fromIdb) {
        return;
      }
      if (wasRecentAlertShown(fromIdb.alarmId, fromIdb.fireAt)) {
        return;
      }
      saveRecentAlert(fromIdb);
      show(fromIdb);
    }

    function onRecentAlert(event: Event) {
      const detail = (event as CustomEvent<RecentAlert | null>).detail;
      show(detail);
    }

    function onServiceWorkerMessage(event: MessageEvent) {
      if (
        (event.data?.type === "ALARM_FIRED" || event.data?.type === "ALARM_OPENED") &&
        event.data.id &&
        event.data.fireAt
      ) {
        const next: RecentAlert = {
          alarmId: event.data.id,
          fireAt: event.data.fireAt,
          title: typeof event.data.title === "string" ? event.data.title : "Reminder",
          body: typeof event.data.body === "string" ? event.data.body : "",
          href: typeof event.data.href === "string" ? event.data.href : "/dashboard",
          seenAt: Date.now(),
        };
        saveRecentAlert(next);
        show(next);
      }
    }

    void hydrate();
    window.addEventListener(RECENT_ALERT_EVENT, onRecentAlert);
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);

    return () => {
      cancelled = true;
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
      window.removeEventListener(RECENT_ALERT_EVENT, onRecentAlert);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
    };
  }, []);

  if (!alert) {
    return null;
  }

  function dismiss() {
    markRecentAlertShown(alert.alarmId, alert.fireAt);
    clearRecentAlert();
    setAlert(null);
  }

  function viewSource() {
    markRecentAlertShown(alert.alarmId, alert.fireAt);
    clearRecentAlert();
    setAlert(null);
    router.push(alert.href || "/dashboard");
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[110] flex justify-center px-3 md:top-4">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-xl border border-app-accent/30 bg-panel px-3 py-3 shadow-lg ring-1 ring-app-accent/20"
      >
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-accent-soft text-app-accent">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-app-fg">{alert.title}</p>
          {alert.body ? <p className="mt-0.5 text-sm text-app-subtle">{alert.body}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={viewSource}
              className="rounded-md bg-app-accent px-2.5 py-1 text-xs font-medium text-white hover:opacity-95"
            >
              View
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-md border border-app-border bg-app-muted px-2.5 py-1 text-xs font-medium text-app-fg hover:bg-app-accent-soft"
            >
              Dismiss
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md p-1 text-app-subtle hover:bg-app-muted hover:text-app-fg"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
