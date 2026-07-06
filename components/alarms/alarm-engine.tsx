"use client";

import { useCallback, useEffect, useRef } from "react";
import { buildClassAlarms, buildExamAlarms, buildTodoAlarms, mergeAlarms } from "@/lib/alarms/build-alarms";
import { playAlarmSound } from "@/lib/alarms/play-alarm-sound";
import {
  ALARM_CHECK_INTERVAL_MS,
  runAlarmSweep,
  scheduleAlarmTimers,
  syncAlarmsToServiceWorker,
} from "@/lib/alarms/scheduler";
import { markAlarmFired } from "@/lib/alarms/fired-store";
import { deliverAlarm } from "@/lib/alarms/notifications";
import type { ScheduledAlarm } from "@/lib/alarms/types";
import { getCoursePlan } from "@/lib/data/course-plan";
import { listCourses } from "@/lib/data/courses";
import { fetchExamTimetableFromFirestore } from "@/lib/data/exam-timetable";
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
    if (!user || !activeSemesterId) {
      return [];
    }

    const courses = await listCourses(user.uid, activeSemesterId);
    const todoAlarms = (
      await Promise.all(
        courses.map(async (course) => {
          try {
            const plan = await getCoursePlan(user.uid, activeSemesterId, course.id);
            return buildTodoAlarms(course.id, course.title, plan.todos);
          } catch {
            return [];
          }
        }),
      )
    ).flat();

    let examStorage = hasFirebaseConfig
      ? await fetchExamTimetableFromFirestore(user.uid, activeSemesterId)
      : null;
    if (!examStorage) {
      examStorage = loadExamTimetableLocal(user.uid, activeSemesterId);
    }

    const examAlarms = examStorage
      ? buildExamAlarms(activeSemesterId, examStorage.columns, examStorage.rows)
      : [];

    const classAlarms = classAlarmsEnabled()
      ? buildClassAlarms(resolveTimetableRaw(user.uid, activeSemesterId))
      : [];

    return mergeAlarms(todoAlarms, examAlarms, classAlarms);
  }, [user, activeSemesterId]);

  useEffect(() => {
    if (!user || !activeSemesterId || semesterLoading) {
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
      runAlarmSweep(alarms);
      await syncAlarmsToServiceWorker(alarms);
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

    function onVisibility() {
      if (document.visibilityState === "visible") {
        runAlarmSweep(alarmsRef.current);
        void refresh();
      }
    }

    function onServiceWorkerMessage(event: MessageEvent) {
      if (event.data?.type === "PLAY_ALARM_SOUND") {
        void playAlarmSound();
      }
      if (event.data?.type === "ALARM_FIRED" && event.data.id && event.data.fireAt) {
        markAlarmFired(event.data.id, event.data.fireAt);
      }
    }

    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      clearTimers();
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
    };
  }, [user, activeSemesterId, semesterLoading, loadAlarms]);

  return null;
}
