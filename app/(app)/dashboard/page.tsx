"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { listCourses } from "@/lib/data/courses";
import { listTopics } from "@/lib/data/topics";
import { getClientAuth } from "@/lib/firebase/auth";
import { TIMETABLE_LEGACY_STORAGE_KEY, timetableStorageKeyForUserSemester } from "@/lib/timetable-storage";
import type { Topic } from "@/lib/types/domain";
import { useAuth } from "@/providers/auth-provider";
import { useSemester } from "@/providers/semester-provider";

function resolveTimetableRaw(uid: string | undefined, semesterId: string | null): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (uid && semesterId) {
    const scoped = timetableStorageKeyForUserSemester(uid, semesterId);
    return window.localStorage.getItem(scoped) ?? window.localStorage.getItem(TIMETABLE_LEGACY_STORAGE_KEY);
  }
  return window.localStorage.getItem(TIMETABLE_LEGACY_STORAGE_KEY);
}
const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type TimetableEntry = {
  courseName?: string;
  location?: string;
  durationHours?: number;
};

type TimetableStorage = {
  entries?: Record<string, TimetableEntry>;
};

type CurrentClass = {
  courseName: string;
  location: string;
  startHour: number;
  endHour: number;
};

type PriorityTopic = {
  courseName: string;
  topicTitle: string;
};

type MissionTopic = {
  courseName: string;
  topicTitle: string;
  notes: string;
  isFromNextClass: boolean;
};

function formatHour(hour: number) {
  const normalized = ((hour % 24) + 24) % 24;
  const displayHour = normalized % 12 === 0 ? 12 : normalized % 12;
  const suffix = normalized < 12 ? "AM" : "PM";
  return `${displayHour}:00 ${suffix}`;
}

/** Inclusive calendar days from startISO through endISO (YYYY-MM-DD, local midnight). */
function semesterElapsedFraction(startISO: string, endISO: string, now: Date): number | null {
  const partsStart = startISO.split("-").map(Number);
  const partsEnd = endISO.split("-").map(Number);
  if (partsStart.length !== 3 || partsEnd.length !== 3) {
    return null;
  }
  const [ys, ms, ds] = partsStart;
  const [ye, me, de] = partsEnd;
  const start = new Date(ys, ms - 1, ds);
  const end = new Date(ye, me - 1, de);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return null;
  }

  const msDay = 86400000;
  const totalDays = Math.floor((end.getTime() - start.getTime()) / msDay) + 1;
  if (totalDays <= 0) {
    return null;
  }

  if (today < start) {
    return 0;
  }
  if (today > end) {
    return 100;
  }

  const elapsedDays = Math.floor((today.getTime() - start.getTime()) / msDay) + 1;
  return Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
}

function getCurrentClassFromStorage(now: Date, timetableRaw: string | null): CurrentClass | null {
  const todayClasses = getTodayClassesFromStorage(now, timetableRaw);
  const currentHour = now.getUTCHours();
  return todayClasses.find((item) => currentHour >= item.startHour && currentHour < item.endHour) ?? null;
}

function getTodayClassesFromStorage(now: Date, timetableRaw: string | null): CurrentClass[] {
  if (!timetableRaw) {
    return [];
  }
  try {
    const parsed = JSON.parse(timetableRaw) as TimetableStorage;
    const entries = parsed.entries ?? {};
    const dayName = weekdayNames[now.getUTCDay()];
    const classes: CurrentClass[] = [];

    for (const [entryKey, entry] of Object.entries(entries)) {
      if (!entryKey.startsWith(`${dayName}-`)) {
        continue;
      }

      const hourPart = entryKey.slice(-5, -3);
      const startHour = Number(hourPart);
      const duration = Math.max(1, Number(entry.durationHours ?? 1));
      const endHour = startHour + duration;
      const courseName = entry.courseName?.trim() ?? "";

      if (!courseName) {
        continue;
      }

      classes.push({
        courseName,
        location: entry.location?.trim() ?? "",
        startHour,
        endHour,
      });
    }

    return classes.sort((a, b) => a.startHour - b.startHour);
  } catch {
    return [];
  }
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeSemesterId, semesters, isLoading: semesterLoading } = useSemester();
  const [currentClass, setCurrentClass] = useState<CurrentClass | null>(null);
  const [nextClass, setNextClass] = useState<CurrentClass | null>(null);
  const [priorityTopic, setPriorityTopic] = useState<PriorityTopic | null>(null);
  const [studyMission, setStudyMission] = useState<string | null>(null);
  const [studyReasoning, setStudyReasoning] = useState<string | null>(null);
  const [missionTopics, setMissionTopics] = useState<MissionTopic[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const reasoningWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function refreshCurrentClass() {
      const now = new Date();
      const timetableRaw = resolveTimetableRaw(user?.uid, activeSemesterId);
      const todayClasses = getTodayClassesFromStorage(now, timetableRaw);
      const active = getCurrentClassFromStorage(now, timetableRaw);
      const currentHour = now.getUTCHours();
      const upcoming = todayClasses.find((item) => item.startHour > currentHour) ?? null;

      setCurrentClass(active);
      setNextClass(upcoming);
    }

    refreshCurrentClass();
    const interval = window.setInterval(refreshCurrentClass, 60_000);

    return () => window.clearInterval(interval);
  }, [user?.uid, activeSemesterId]);

  useEffect(() => {
    let isMounted = true;

    async function loadPriorityTopic() {
      if (!user) {
        setPriorityTopic(null);
        return;
      }

      if (semesterLoading) {
        return;
      }

      const semesterId = activeSemesterId;
      if (!semesterId) {
        setPriorityTopic(null);
        return;
      }

      const courses = await listCourses(user.uid, semesterId);
      let best: { score: number; value: PriorityTopic } | null = null;

      for (const course of courses) {
        const topics = await listTopics(user.uid, semesterId, course.id);
        for (const topic of topics) {
          const stage = topic.learningStage === "mastered" ? "mastered" : topic.taughtInClass ? "taught" : "pending";
          if (stage !== "taught") {
            continue;
          }
          const score = (topic.priorityScore ?? 0) + (course.latestTopicStatus === "taught" ? 200 : 0);
          if (!best || score > best.score) {
            best = {
              score,
              value: {
                courseName: course.title,
                topicTitle: topic.title,
              },
            };
          }
        }
      }

      if (!isMounted) {
        return;
      }
      setPriorityTopic(best?.value ?? null);
    }

    void loadPriorityTopic();
    return () => {
      isMounted = false;
    };
  }, [user, activeSemesterId, semesterLoading]);

  useEffect(() => {
    if (!reasoningOpen) {
      return;
    }
    function handlePointerDown(event: PointerEvent) {
      if (!reasoningWrapRef.current) {
        return;
      }
      if (!reasoningWrapRef.current.contains(event.target as Node)) {
        setReasoningOpen(false);
      }
    }
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [reasoningOpen]);

  const currentClassLabel = useMemo(() => {
    if (!currentClass) {
      return "No class right now (GMT)";
    }

    return `${currentClass.courseName} - ${formatHour(currentClass.startHour)} to ${formatHour(currentClass.endHour)}`;
  }, [currentClass]);

  const nextClassLabel = useMemo(() => {
    if (!nextClass) {
      return "No more classes today (GMT)";
    }
    return `${nextClass.courseName} at ${formatHour(nextClass.startHour)} (GMT)`;
  }, [nextClass]);

  const pulseTitle = useMemo(() => {
    if (currentClass) {
      return `Attend ${currentClass.courseName}`;
    }
    if (nextClass) {
      return `Prepare for ${nextClass.courseName}`;
    }
    if (priorityTopic) {
      return `Deep work: ${priorityTopic.courseName}`;
    }
    return "Plan your next focused study block";
  }, [currentClass, nextClass, priorityTopic]);

  const pulseBody = useMemo(() => {
    if (currentClass) {
      return currentClass.location
        ? `You are currently in session. Location: ${currentClass.location}.`
        : "You are currently in session. Stay focused on the lecture objectives.";
    }
    if (nextClass) {
      return `Your next class starts at ${formatHour(nextClass.startHour)}. Review key notes before it begins.`;
    }
    if (priorityTopic) {
      return `Most urgent taught topic: ${priorityTopic.topicTitle} (${priorityTopic.courseName}). Start a focused 30-minute study block now.`;
    }
    return "No active or upcoming class detected for today. Use this window for revision.";
  }, [currentClass, nextClass, priorityTopic]);

  const semesterProgress = useMemo(() => {
    if (semesterLoading || !activeSemesterId) {
      return null;
    }
    const sem = semesters.find((s) => s.id === activeSemesterId);
    if (!sem?.startDate || !sem?.endDate) {
      return null;
    }
    return semesterElapsedFraction(sem.startDate, sem.endDate, new Date());
  }, [semesters, activeSemesterId, semesterLoading]);

  const semesterProgressLabel = useMemo(() => {
    if (semesterLoading) {
      return "Semester progress: …";
    }
    if (!activeSemesterId) {
      return "Semester progress: choose a semester in the header";
    }
    if (semesterProgress === null) {
      return "Semester progress: set start and end dates for this semester";
    }
    return `Semester progress: ${semesterProgress.toFixed(0)}%`;
  }, [semesterProgress, semesterLoading, activeSemesterId]);

  const activeSemester = useMemo(
    () => semesters.find((s) => s.id === activeSemesterId),
    [semesters, activeSemesterId],
  );

  function topicStatus(topic: Topic): "pending" | "taught" | "mastered" {
    if (topic.learningStage === "mastered") {
      return "mastered";
    }
    if (topic.learningStage === "taught") {
      return "taught";
    }
    if (topic.taughtInClass) {
      return "taught";
    }
    return "pending";
  }

  async function requestAiStudyHint() {
    setAiError(null);
    setReasoningOpen(false);
    const auth = getClientAuth();
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setAiError("Sign in to use AI suggestions.");
      return;
    }

    let idToken: string;
    try {
      idToken = await firebaseUser.getIdToken();
    } catch {
      setAiError("Could not refresh your session.");
      return;
    }

    if (!user || !activeSemesterId) {
      setAiError("Choose an active semester first.");
      return;
    }

    setAiLoading(true);
    try {
      const courses = await listCourses(user.uid, activeSemesterId);
      const nextClassName = nextClass?.courseName.trim().toLowerCase() ?? "";
      const taughtTopics: MissionTopic[] = [];

      for (const course of courses) {
        const topics = await listTopics(user.uid, activeSemesterId, course.id);
        for (const topic of topics) {
          if (topicStatus(topic) !== "taught") {
            continue;
          }
          taughtTopics.push({
            courseName: course.title,
            topicTitle: topic.title,
            notes: topic.notes?.trim() ?? "",
            isFromNextClass:
              nextClassName.length > 0 && course.title.trim().toLowerCase() === nextClassName,
          });
        }
      }

      if (taughtTopics.length === 0) {
        setStudyMission(
          "No taught topics are waiting. Mark a topic as Taught in Class on a course syllabus to get a mission.",
        );
        setStudyReasoning(null);
        setMissionTopics([]);
        return;
      }

      const ranked = taughtTopics
        .map((topic, index) => ({
          topic,
          score: (topic.isFromNextClass ? 1000 : 0) + (topic.notes ? 25 : 0) - index,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((item) => item.topic);

      setMissionTopics(ranked);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          topics: ranked,
          context: {
            pulseTitle,
            pulseBody,
            semesterName: activeSemester?.name,
            nextClass: nextClass?.courseName ?? null,
          },
        }),
      });
      const data = (await res.json()) as { mission?: string; reasoning?: string; error?: string };
      if (!res.ok) {
        setStudyMission(null);
        setStudyReasoning(null);
        setAiError(data.error ?? "Could not get a suggestion.");
        return;
      }
      if (typeof data.mission === "string" && typeof data.reasoning === "string") {
        setStudyMission(data.mission);
        setStudyReasoning(data.reasoning);
        setReasoningOpen(false);
      } else {
        setStudyMission(null);
        setStudyReasoning(null);
        setAiError("Unexpected response from the assistant.");
      }
    } catch {
      setAiError("Network error. Try again.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-app-border bg-panel p-6">
        <p className="text-sm text-app-subtle">The Pulse</p>
        <h2 className="mt-1 text-xl font-semibold text-app-fg">{pulseTitle}</h2>
        <p className="mt-2 text-sm text-app-subtle">{pulseBody}</p>
        <div className="mt-5 space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-app-muted">
            <div
              className="h-full min-w-0 rounded-full bg-app-accent transition-[width] duration-300"
              style={{
                width:
                  semesterProgress === null ? "0%" : `${Math.min(100, Math.max(0, semesterProgress))}%`,
              }}
            />
          </div>
          <p className="text-xs text-app-subtle">{semesterProgressLabel}</p>
        </div>

        <div className="mt-5 space-y-2 border-t border-app-border pt-5">
          <p className="text-sm text-app-subtle">AI study nudge</p>
          <button
            type="button"
            disabled={aiLoading}
            onClick={() => void requestAiStudyHint()}
            className="rounded-lg border border-app-border bg-white px-4 py-2 text-sm font-medium text-app-fg transition hover:bg-app-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {aiLoading ? "Thinking…" : "Get a tailored next step"}
          </button>
          {studyMission ? (
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => void requestAiStudyHint()}
              className="ml-2 rounded-lg border border-app-border bg-white px-4 py-2 text-sm font-medium text-app-fg transition hover:bg-app-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiLoading ? "Regenerating…" : "Regenerate"}
            </button>
          ) : null}
          {aiError ? <p className="text-sm text-red-700">{aiError}</p> : null}
          {missionTopics.length > 0 ? (
            <div className="rounded-lg border border-app-border bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-app-subtle">Top taught topics</p>
              <ul className="mt-1 space-y-1">
                {missionTopics.map((topic) => (
                  <li key={`${topic.courseName}-${topic.topicTitle}`} className="text-sm text-app-fg">
                    {topic.topicTitle} ({topic.courseName})
                    {topic.isFromNextClass ? " - next class" : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {studyMission ? (
            <div className="rounded-xl border border-app-border bg-gradient-to-br from-white to-app-muted/40 p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <p className="text-xs uppercase tracking-wide text-app-subtle">Study mission</p>
                {studyReasoning ? (
                  <div ref={reasoningWrapRef} className="group relative">
                    <button
                      type="button"
                      onClick={() => setReasoningOpen((current) => !current)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-app-border text-[11px] text-app-subtle hover:bg-app-muted"
                      aria-label="Why this mission?"
                      title="Why this?"
                      aria-expanded={reasoningOpen}
                    >
                      ?
                    </button>
                    <div
                      className={`absolute left-0 top-6 z-10 w-72 rounded-lg border border-app-border bg-white p-2 text-xs leading-relaxed text-app-fg shadow-lg ${
                        reasoningOpen ? "block" : "hidden group-hover:block group-focus-within:block"
                      }`}
                    >
                      {studyReasoning}
                    </div>
                  </div>
                ) : null}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-app-fg">{studyMission}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-app-border bg-panel p-5">
          <p className="text-sm text-app-subtle">Current class</p>
          <p className="mt-1 text-base font-medium text-app-fg">{currentClassLabel}</p>
          {currentClass?.location ? (
            <p className="mt-1 text-sm text-app-subtle">Location: {currentClass.location}</p>
          ) : null}
        </article>
        <article className="rounded-2xl border border-app-border bg-panel p-5">
          <p className="text-sm text-app-subtle">Next class today</p>
          <p className="mt-1 text-base font-medium text-app-fg">{nextClassLabel}</p>
          {priorityTopic ? (
            <p className="mt-1 text-sm text-app-subtle">
              Priority topic: {priorityTopic.topicTitle} ({priorityTopic.courseName}) - taught
            </p>
          ) : null}
        </article>
      </section>
    </div>
  );
}
