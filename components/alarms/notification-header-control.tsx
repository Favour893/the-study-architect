"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, CheckCircle2, Smartphone } from "lucide-react";
import { ALARMS_CHANGED_EVENT, notifyAlarmsChanged } from "@/lib/alarms/alarm-events";
import {
  areAppNotificationsEnabled,
  setAppNotificationsEnabled,
} from "@/lib/alarms/notification-preference";
import { registerBackgroundAlarmWake } from "@/lib/alarms/scheduler";
import { ShimmerButton } from "@/components/ui/shimmer";
import { ensureFcmToken, hasFcmClientConfig } from "@/lib/firebase/messaging";
import {
  ensureNotificationPermission,
  getNotificationPermissionState,
  hasNotificationPermission,
  sendTestNotification,
  type NotificationPermissionState,
} from "@/lib/alarms/notifications";
import { useAuth } from "@/providers/auth-provider";
import { syncAlarmDispatch, saveAlarmDispatchMeta } from "@/lib/data/alarm-dispatch";
import { requestTestPush } from "@/lib/alarms/server-dispatch";
import { getClientAuth } from "@/lib/firebase/auth";

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
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [appEnabled, setAppEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [pushTokenReady, setPushTokenReady] = useState<boolean | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function refreshState() {
      setPermission(getNotificationPermissionState());
      setAppEnabled(areAppNotificationsEnabled());
    }
    refreshState();
    document.addEventListener("visibilitychange", refreshState);
    window.addEventListener(ALARMS_CHANGED_EVENT, refreshState);
    window.addEventListener("storage", refreshState);
    return () => {
      document.removeEventListener("visibilitychange", refreshState);
      window.removeEventListener(ALARMS_CHANGED_EVENT, refreshState);
      window.removeEventListener("storage", refreshState);
    };
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
  const notificationsActive = hasNotificationPermission() && appEnabled;
  const pushReady = hasFcmClientConfig();

  async function syncPushRegistration(enabled: boolean) {
    if (!user) {
      return;
    }
    if (!enabled) {
      setPushTokenReady(false);
      await saveAlarmDispatchMeta(user.uid, { notificationsEnabled: false });
      await syncAlarmDispatch(user.uid, [], null);
      return;
    }
    if (!hasNotificationPermission() || !areAppNotificationsEnabled()) {
      return;
    }
    const token = await ensureFcmToken();
    setPushTokenReady(Boolean(token));
    await saveAlarmDispatchMeta(user.uid, {
      fcmToken: token,
      notificationsEnabled: true,
    });
  }

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
        setAppNotificationsEnabled(true);
        setAppEnabled(true);
        await ensureFcmToken();
        await registerBackgroundAlarmWake();
        await syncPushRegistration(true);
        notifyAlarmsChanged();
        await sendTestNotification();
        setTestSent(true);
        setOpen(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleNotifications() {
    if (busy) {
      return;
    }

    if (!hasNotificationPermission()) {
      await enableNotifications();
      return;
    }

    setBusy(true);
    setTestSent(false);
    try {
      const nextEnabled = !appEnabled;
      setAppNotificationsEnabled(nextEnabled);
      setAppEnabled(nextEnabled);
      if (nextEnabled) {
        await ensureFcmToken();
        await registerBackgroundAlarmWake();
        await syncPushRegistration(true);
      } else {
        await syncPushRegistration(false);
      }
      notifyAlarmsChanged();
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setTestSent(false);
    setTestMessage(null);
    try {
      await syncPushRegistration(true);
      const localOk = await sendTestNotification();

      const firebaseUser = getClientAuth().currentUser;
      if (!firebaseUser) {
        setTestSent(localOk);
        setTestMessage(localOk ? "Local test shown. Sign in again to verify background push." : null);
        return;
      }
      const idToken = await firebaseUser.getIdToken();
      const push = await requestTestPush(idToken);
      if (push.ok) {
        setTestSent(true);
        setTestMessage(
          "Background push sent. Close TSA (or lock the phone) — you should get a system alert with the phone’s notification sound.",
        );
      } else {
        setTestSent(localOk);
        setTestMessage(
          push.hint ||
            (push.error === "missing_fcm_token"
              ? "Push token missing. Toggle notifications off/on, then try again."
              : `Background push failed: ${push.error || "unknown"}. Local chime still played.`),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  if (permission === "default") {
    return (
      <div className="relative shrink-0" ref={wrapRef}>
        <ShimmerButton
          type="button"
          loading={busy}
          loadingLabel="Checking…"
          onClick={() => void enableNotifications()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60 sm:px-3 sm:text-sm"
          title={needsIosInstall ? "Install TSA to Home Screen first" : "Enable notifications for alarms"}
        >
          {needsIosInstall ? <Smartphone className="h-4 w-4 shrink-0" /> : <Bell className="h-4 w-4 shrink-0" />}
          <span className="hidden sm:inline">
            {needsIosInstall ? "Install app for alerts" : "Enable notifications"}
          </span>
          <span className="sr-only sm:hidden">
            {needsIosInstall ? "Install app for alerts" : "Enable notifications"}
          </span>
        </ShimmerButton>
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
          notificationsActive
            ? "border-emerald-400/50 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
            : "border-amber-400/50 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={
          permission === "denied"
            ? "Notifications blocked"
            : notificationsActive
              ? "Notifications on"
              : "Notifications off"
        }
      >
        {notificationsActive ? (
          <Bell className="h-4 w-4 shrink-0" />
        ) : (
          <BellOff className="h-4 w-4 shrink-0" />
        )}
        <span className="hidden sm:inline">
          {permission === "denied"
            ? "Notifications blocked"
            : notificationsActive
              ? "Notifications on"
              : "Notifications off"}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[min(100vw-1.5rem,18rem)] rounded-xl border border-app-border bg-panel p-3 shadow-lg">
          {permission === "granted" ? (
            <>
              <ShimmerButton
                type="button"
                loading={busy}
                onClick={() => void toggleNotifications()}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-app-border bg-app-muted px-3 py-2.5 text-left transition hover:bg-app-accent-soft disabled:opacity-60"
                aria-pressed={appEnabled}
              >
                <div>
                  <p className="text-sm font-medium text-app-fg">Notifications</p>
                  <p className="mt-0.5 text-xs text-app-subtle">
                    {appEnabled
                      ? "When closed, your phone shows a system alert. Custom chimes play while TSA is open."
                      : "Alarms are paused on this device."}
                  </p>
                  {appEnabled && !pushReady ? (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Background push is not configured on the server yet (missing VAPID key).
                    </p>
                  ) : null}
                  {appEnabled && pushReady && pushTokenReady === false ? (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Push token not registered on this device yet. Toggle notifications off/on, or allow
                      notifications again.
                    </p>
                  ) : null}
                  {appEnabled && pushTokenReady === true ? (
                    <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                      Background push registered on this device.
                    </p>
                  ) : null}
                </div>
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                    appEnabled ? "bg-app-accent" : "bg-app-border"
                  }`}
                  aria-hidden
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                      appEnabled ? "left-4" : "left-0.5"
                    }`}
                  />
                </span>
              </ShimmerButton>

              {appEnabled ? (
                <>
                  {testSent || testMessage ? (
                    <div className="mt-3 flex items-start gap-2">
                      <CheckCircle2
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          testSent
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      />
                      <p
                        className={`text-xs font-medium ${
                          testSent
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-amber-800 dark:text-amber-200"
                        }`}
                      >
                        {testMessage || "Test notification sent."}
                      </p>
                    </div>
                  ) : null}
                  <ShimmerButton
                    type="button"
                    loading={busy}
                    loadingLabel="Sending…"
                    onClick={() => void sendTest()}
                    className="mt-3 w-full rounded-lg border border-app-border bg-panel px-3 py-1.5 text-xs font-medium text-app-fg hover:bg-app-muted disabled:opacity-60"
                  >
                    Send background push test
                  </ShimmerButton>
                </>
              ) : null}
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
