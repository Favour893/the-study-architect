"use client";

import { useCallback, useEffect, useRef } from "react";
import { ALARMS_CHANGED_EVENT } from "@/lib/alarms/alarm-events";
import {
  buildClassAlarms,
  buildExamAlarms,
  buildPersonalTodoAlarms,
  mergeAlarms,
} from "@/lib/alarms/build-alarms";
import { playAlarmSound, stopAlarmSound } from "@/lib/alarms/play-alarm-sound";
import {
  ALARM_CHECK_INTERVAL_MS,
  mergeFiredKeysFromServiceWorker,
  registerBackgroundAlarmWake,
  runAlarmSweep,
  scheduleAlarmTimers,
  syncAlarmsToServiceWorker,
} from "@/lib/alarms/scheduler";
import { markAlarmFired } from "@/lib/alarms/fired-store";
import { deliverAlarm, canUseNotifications } from "@/lib/alarms/notifications";
import type { ScheduledAlarm } from "@/lib/alarms/types";
import { fetchExamTimetableFromFirestore } from "@/lib/data/exam-timetable";
import { getPersonalLog } from "@/lib/data/personal-log";
import { loadExamTimetableLocal } from "@/lib/exam-timetable-storage";
import { hasFirebaseConfig } from "@/lib/firebase/client";
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

export function AlarmEngine() {
  const { user } = useAuth();
  const { activeSemesterId, isLoading: semesterLoading } = useSemester();
  const alarmsRef = useRef<ScheduledAlarm[]>([]);

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

    let cancelled = false;
    let clearTimers = () => {};

    async function refresh() {
      const alarms = await loadAlarms();
      if (cancelled) {
        return;
      }
      alarmsRef.current = alarms;
      await mergeFiredKeysFromServiceWorker();
      if (canUseNotifications()) {
        await runAlarmSweep(alarms);
      }
      await syncAlarmsToServiceWorker(canUseNotifications() ? alarms : []);
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
      void refresh();
    }

    async function flushAlarmsToServiceWorker() {
      const alarms = await loadAlarms();
      if (cancelled) {
        return;
      }
      alarmsRef.current = alarms;
      await syncAlarmsToServiceWorker(canUseNotifications() ? alarms : []);
      if (canUseNotifications()) {
        await registerBackgroundAlarmWake();
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        if (canUseNotifications()) {
          runAlarmSweep(alarmsRef.current);
        }
        void refresh();
        return;
      }
      void flushAlarmsToServiceWorker();
    }

    function onPageHide() {
      void flushAlarmsToServiceWorker();
    }

    function onServiceWorkerMessage(event: MessageEvent) {
      if (event.data?.type === "PLAY_ALARM_SOUND") {
        void playAlarmSound();
      }
      if (event.data?.type === "STOP_ALARM_SOUND") {
        stopAlarmSound();
      }
      if (event.data?.type === "ALARM_FIRED" && event.data.id && event.data.fireAt) {
        markAlarmFired(event.data.id, event.data.fireAt);
      }
      if (event.data?.type === "ALARM_DISMISSED" && event.data.id && event.data.fireAt) {
        markAlarmFired(event.data.id, event.data.fireAt);
        stopAlarmSound();
      }
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener(ALARMS_CHANGED_EVENT, onAlarmsChanged);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      clearTimers();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ALARMS_CHANGED_EVENT, onAlarmsChanged);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
    };
  }, [user, activeSemesterId, semesterLoading, loadAlarms]);

  return null;
}
