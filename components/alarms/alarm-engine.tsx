"use client";

import { useCallback, useEffect, useRef } from "react";
import { loadCachedAlarms, saveCachedAlarms } from "@/lib/alarms/alarm-cache";
import { ALARMS_CHANGED_EVENT } from "@/lib/alarms/alarm-events";
import {
  buildClassAlarms,
  buildExamAlarms,
  buildPersonalTodoAlarms,
  mergeAlarms,
} from "@/lib/alarms/build-alarms";
import { playAlarmSound } from "@/lib/alarms/play-alarm-sound";
import {
  ALARM_CHECK_INTERVAL_MS,
  flushAlarmScheduleToServiceWorker,
  mergeFiredKeysFromServiceWorker,
  registerBackgroundAlarmWake,
  runAlarmSweep,
  scheduleAlarmTimers,
  syncAlarmsToServiceWorker,
} from "@/lib/alarms/scheduler";
import { requestServerAlarmDispatch } from "@/lib/alarms/server-dispatch";
import { saveRecentAlert } from "@/lib/alarms/alert-deep-link";
import { markAlarmFired } from "@/lib/alarms/fired-store";
import { canUseNotifications, deliverAlarm, stopAllAlarmAudio } from "@/lib/alarms/notifications";
import type { ScheduledAlarm } from "@/lib/alarms/types";
import {
  markAlarmJobDismissed,
  mergeFiredKeysFromAlarmJobs,
  syncAlarmDispatch,
} from "@/lib/data/alarm-dispatch";
import { fetchExamTimetableFromFirestore } from "@/lib/data/exam-timetable";
import { getPersonalLog } from "@/lib/data/personal-log";
import { loadExamTimetableLocal } from "@/lib/exam-timetable-storage";
import { hasFirebaseConfig } from "@/lib/firebase/client";
import { getClientAuth } from "@/lib/firebase/auth";
import { ensureFcmToken } from "@/lib/firebase/messaging";
import { TIMETABLE_LEGACY_STORAGE_KEY, timetableStorageKeyForUserSemester } from "@/lib/timetable-storage";
import { useAuth } from "@/providers/auth-provider";
import { useSemester } from "@/providers/semester-provider";

const CLASS_ALARMS_ENABLED_KEY = "tsa.class-alarms.enabled";

function resolveTimetableRaw(uid: string, semesterId: string) {
  const scoped = timetableStorageKeyForUserSemester(uid, semesterId);
  return window.localStorage.getItem(scoped) ?? window.localStorage.getItem(TIMETABLE_LEGACY_STORAGE_KEY);
}

function classAlarmsEnabled() {
  const stored = window.localStorage.getItem(CLASS_ALARMS_ENABLED_KEY);
  return stored !== "false";
}

function resolveAlarmsForFlush(alarmsRef: ScheduledAlarm[]) {
  if (alarmsRef.length > 0) {
    return alarmsRef;
  }
  return loadCachedAlarms();
}

export function AlarmEngine() {
  const { user } = useAuth();
  const { activeSemesterId, isLoading: semesterLoading } = useSemester();
  const alarmsRef = useRef<ScheduledAlarm[]>([]);
  const fcmTokenRef = useRef<string | null>(null);

  const loadAlarms = useCallback(async () => {
    if (!user) {
      return [];
    }

    let personalTodoAlarms: ScheduledAlarm[] = [];
    try {
      const personalLog = await getPersonalLog(user.uid);
      personalTodoAlarms = buildPersonalTodoAlarms(personalLog.todos);
    } catch {
      personalTodoAlarms = [];
    }

    if (!activeSemesterId) {
      return mergeAlarms(personalTodoAlarms);
    }

    const localExamStorage = loadExamTimetableLocal(user.uid, activeSemesterId);
    const cloudExamStorage = hasFirebaseConfig
      ? await fetchExamTimetableFromFirestore(user.uid, activeSemesterId)
      : null;
    const examStorage = localExamStorage ?? cloudExamStorage;

    const examAlarms = examStorage
      ? buildExamAlarms(activeSemesterId, examStorage.columns, examStorage.rows)
      : [];

    const classAlarms = classAlarmsEnabled()
      ? buildClassAlarms(resolveTimetableRaw(user.uid, activeSemesterId))
      : [];

    return mergeAlarms(personalTodoAlarms, examAlarms, classAlarms);
  }, [user, activeSemesterId]);

  useEffect(() => {
    if (!user || semesterLoading) {
      alarmsRef.current = [];
      return;
    }

    const uid = user.uid;
    let cancelled = false;
    let clearTimers = () => {};

    async function ensurePushToken() {
      if (!canUseNotifications()) {
        fcmTokenRef.current = null;
        return null;
      }
      const token = await ensureFcmToken();
      fcmTokenRef.current = token;
      return token;
    }

    async function dispatchServerAlarms() {
      if (!hasFirebaseConfig || !canUseNotifications()) {
        return;
      }
      try {
        const firebaseUser = getClientAuth().currentUser;
        if (!firebaseUser) {
          return;
        }
        const idToken = await firebaseUser.getIdToken();
        await requestServerAlarmDispatch(idToken);
      } catch {
        // Server push is best-effort.
      }
    }

    async function pushAlarmsToBackground(alarms: ScheduledAlarm[]) {
      alarmsRef.current = alarms;
      saveCachedAlarms(alarms);
      const token = await ensurePushToken();
      await syncAlarmsToServiceWorker(canUseNotifications() ? alarms : []);
      if (hasFirebaseConfig) {
        try {
          await syncAlarmDispatch(uid, canUseNotifications() ? alarms : [], token);
        } catch {
          // Cloud dispatch is best-effort; local scheduling still runs.
        }
      }
    }

    async function syncAlarmsNow() {
      const alarms = await loadAlarms();
      await pushAlarmsToBackground(alarms);
      if (canUseNotifications()) {
        await registerBackgroundAlarmWake();
      }
    }

    async function refresh() {
      const alarms = await loadAlarms();
      if (cancelled) {
        return;
      }
      await mergeFiredKeysFromServiceWorker();
      if (hasFirebaseConfig) {
        try {
          await mergeFiredKeysFromAlarmJobs(uid);
        } catch {
          // Ignore cloud merge failures.
        }
      }
      if (canUseNotifications()) {
        await runAlarmSweep(alarms);
      }
      await pushAlarmsToBackground(alarms);
      void dispatchServerAlarms();
      clearTimers();
      clearTimers = scheduleAlarmTimers(alarms, (alarm) => {
        void deliverAlarm(alarm);
      });
    }

    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, ALARM_CHECK_INTERVAL_MS);

    function onStorage(event: StorageEvent) {
      if (!event.key) {
        return;
      }
      if (event.key.includes("timetable") || event.key.includes("exam-timetable")) {
        void refresh();
      }
    }

    function onAlarmsChanged() {
      void syncAlarmsNow();
      void refresh();
    }

    function flushOnExit() {
      const alarms = resolveAlarmsForFlush(alarmsRef.current);
      void flushAlarmScheduleToServiceWorker(canUseNotifications() ? alarms : []);
      if (hasFirebaseConfig) {
        void syncAlarmDispatch(uid, canUseNotifications() ? alarms : [], fcmTokenRef.current);
        void dispatchServerAlarms();
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void refresh();
        return;
      }
      flushOnExit();
    }

    function onServiceWorkerMessage(event: MessageEvent) {
      if (event.data?.type === "PLAY_ALARM_SOUND") {
        void playAlarmSound();
      }
      if (event.data?.type === "STOP_ALARM_SOUND") {
        stopAllAlarmAudio();
      }
      if (event.data?.type === "ALARM_FIRED" && event.data.id && event.data.fireAt) {
        markAlarmFired(event.data.id, event.data.fireAt);
        const matched = alarmsRef.current.find(
          (alarm) => alarm.id === event.data.id && alarm.fireAt === event.data.fireAt,
        );
        saveRecentAlert({
          alarmId: event.data.id,
          fireAt: event.data.fireAt,
          title:
            matched?.title ??
            (typeof event.data.title === "string" ? event.data.title : "Reminder"),
          body:
            matched?.body ?? (typeof event.data.body === "string" ? event.data.body : ""),
          href:
            matched?.href ??
            (typeof event.data.href === "string" ? event.data.href : "/dashboard"),
        });
      }
      if (event.data?.type === "ALARM_OPENED" && event.data.id && event.data.fireAt) {
        markAlarmFired(event.data.id, event.data.fireAt);
        saveRecentAlert({
          alarmId: event.data.id,
          fireAt: event.data.fireAt,
          title: typeof event.data.title === "string" ? event.data.title : "Reminder",
          body: typeof event.data.body === "string" ? event.data.body : "",
          href: typeof event.data.href === "string" ? event.data.href : "/dashboard",
        });
        stopAllAlarmAudio();
        if (hasFirebaseConfig) {
          void markAlarmJobDismissed(uid, event.data.id, event.data.fireAt);
        }
      }
      if (event.data?.type === "ALARM_DISMISSED" && event.data.id && event.data.fireAt) {
        markAlarmFired(event.data.id, event.data.fireAt);
        stopAllAlarmAudio();
        if (hasFirebaseConfig) {
          void markAlarmJobDismissed(uid, event.data.id, event.data.fireAt);
        }
      }
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener(ALARMS_CHANGED_EVENT, onAlarmsChanged);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushOnExit);
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);

    return () => {
      cancelled = true;
      flushOnExit();
      window.clearInterval(intervalId);
      clearTimers();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ALARMS_CHANGED_EVENT, onAlarmsChanged);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushOnExit);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
    };
  }, [user, activeSemesterId, semesterLoading, loadAlarms]);

  return null;
}
