"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlarmClock, Bell, BookOpen, CalendarClock, CheckSquare, ClipboardList } from "lucide-react";
import { buildCombinedDocumentContextForAi, listCourseDocuments } from "@/lib/data/course-documents";
import { listCourses } from "@/lib/data/courses";
import { loadPulseFeed } from "@/lib/data/pulse-feed";
import { getUserProfile } from "@/lib/data/semesters";
import { listTopics } from "@/lib/data/topics";
import { getClientAuth } from "@/lib/firebase/auth";
import { pickPulseHeadline, upcomingWithinDays, type PulseFeedItem } from "@/lib/pulse/upcoming-items";
import { rankMissionTopics, resolveTopicStage } from "@/lib/pulse/study-mission";
import { TIMETABLE_LEGACY_STORAGE_KEY, timetableStorageKeyForUserSemester } from "@/lib/timetable-storage";
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
  const [studyMission, setStudyMission] = useState<string | null>(null);
  const [studyReasoning, setStudyReasoning] = useState<string | null>(null);
  const [missionTopics, setMissionTopics] = useState<MissionTopic[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const reasoningWrapRef = useRef<HTMLDivElement | null>(null);
  const [pulseFeed, setPulseFeed] = useState<PulseFeedItem[]>([]);
  const [pulseFeedLoading, setPulseFeedLoading] = useState(true);

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
    let cancelled = false;

    async function loadFeed() {
      if (!user || !activeSemesterId || semesterLoading) {
        if (!cancelled) {
          setPulseFeed([]);
          setPulseFeedLoading(false);
        }
        return;
      }
      setPulseFeedLoading(true);
      try {
        const items = await loadPulseFeed(user.uid, activeSemesterId);
        if (!cancelled) {
          setPulseFeed(items);
        }
      } catch {
        if (!cancelled) {
          setPulseFeed([]);
        }
      } finally {
        if (!cancelled) {
          setPulseFeedLoading(false);
        }
      }
    }

    void loadFeed();
    const interval = window.setInterval(() => void loadFeed(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
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

  const pulseHeadline = useMemo(() => pickPulseHeadline(pulseFeed, new Date()), [pulseFeed]);

  const upcomingItems = useMemo(
    () => upcomingWithinDays(pulseFeed, new Date(), 21),
    [pulseFeed],
  );

  const pulseTitle = useMemo(() => {
    if (currentClass) {
      return `Attend ${currentClass.courseName}`;
    }
    if (nextClass) {
      return `Prepare for ${nextClass.courseName}`;
    }
    if (pulseHeadline) {
      if (pulseHeadline.overdue) {
        return pulseHeadline.kind === "exam" ? `Overdue exam prep: ${pulseHeadline.title}` : `Overdue: ${pulseHeadline.title}`;
      }
      if (pulseHeadline.kind === "exam") {
        return `Exam coming up: ${pulseHeadline.title}`;
      }
      return pulseHeadline.title;
    }
    return "Plan your next focused study block";
  }, [currentClass, nextClass, pulseHeadline]);

  const pulseBody = useMemo(() => {
    if (currentClass) {
      return currentClass.location
        ? `You are currently in session. Location: ${currentClass.location}.`
        : "You are currently in session. Stay focused on the lecture objectives.";
    }
    if (nextClass) {
      return `Your next class starts at ${formatHour(nextClass.startHour)}. Review key notes before it begins.`;
    }
    if (pulseHeadline) {
      const alarmNote = pulseHeadline.hasAlarm ? " Alarm is set." : "";
      if (pulseHeadline.kind === "exam") {
        return `${pulseHeadline.whenLabel}. ${pulseHeadline.subtitle}.${alarmNote}`;
      }
      return `${pulseHeadline.courseName} · ${pulseHeadline.whenLabel}.${alarmNote}`;
    }
    return "Add to-dos on course pages or exams on your Timetable to see them here.";
  }, [currentClass, nextClass, pulseHeadline]);

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
          if (resolveTopicStage(topic) !== "taught") {
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
          "Add to-dos on a course page first — the assistant works best when it knows what you are working toward.",
        );
        setStudyReasoning(null);
        setMissionTopics([]);
        return;
      }

      const ranked = rankMissionTopics(taughtTopics, 3);

      setMissionTopics(ranked);

      const profile = await getUserProfile(user.uid);
      const programmeOfStudy = profile?.programmeOfStudy?.trim() || null;

      let importedReferenceForNextClass: string | null = null;
      if (nextClass?.courseName?.trim()) {
        const nextName = nextClass.courseName.trim().toLowerCase();
        const nextCourse = courses.find((c) => c.title.trim().toLowerCase() === nextName);
        if (nextCourse) {
          const docs = await listCourseDocuments(user.uid, activeSemesterId, nextCourse.id);
          const excerpt = buildCombinedDocumentContextForAi(docs);
          if (excerpt.length > 0) {
            importedReferenceForNextClass = excerpt;
          }
        }
      }

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
            programmeOfStudy,
            importedReferenceForNextClass,
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
      <section className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-sky-500 via-violet-500 via-50% to-amber-400" />
        <div className="p-6">
        <p className="text-sm font-semibold text-app-violet">The Pulse</p>
        <h2 className="mt-1 text-xl font-semibold text-app-fg">{pulseTitle}</h2>
        <p className="mt-2 text-sm text-app-subtle">{pulseBody}</p>
        <div className="mt-5 space-y-2" data-page-guide="pulse-progress">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-app-muted">
            <div
              className="h-full min-w-0 rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-teal-400 transition-[width] duration-300"
              style={{
                width:
                  semesterProgress === null ? "0%" : `${Math.min(100, Math.max(0, semesterProgress))}%`,
              }}
            />
          </div>
          <p className="text-xs text-app-subtle">{semesterProgressLabel}</p>
        </div>

        <div className="mt-5 space-y-2 border-t border-app-border pt-5" data-page-guide="pulse-ai">
          <p className="text-sm text-app-subtle">AI study nudge</p>
          <button
            type="button"
            disabled={aiLoading}
            onClick={() => void requestAiStudyHint()}
            className="rounded-lg bg-gradient-to-r from-app-accent to-app-violet px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-500/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {aiLoading ? "Thinking…" : "Get a tailored next step"}
          </button>
          {studyMission ? (
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => void requestAiStudyHint()}
              className="ml-2 rounded-lg border border-app-accent/30 bg-app-accent-soft px-4 py-2 text-sm font-medium text-app-accent transition hover:bg-app-accent-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiLoading ? "Regenerating…" : "Regenerate"}
            </button>
          ) : null}
          {aiError ? <p className="text-sm text-red-700">{aiError}</p> : null}
          {missionTopics.length > 0 ? (
            <div className="rounded-lg border border-violet-200 bg-app-violet-soft p-3 dark:border-violet-900/50">
              <p className="text-xs font-medium uppercase tracking-wide text-app-violet">Top taught topics</p>
              <ul className="mt-2 space-y-1.5">
                {missionTopics.map((topic, index) => (
                  <li
                    key={`${topic.courseName}-${topic.topicTitle}`}
                    className="flex items-start gap-2 text-sm text-app-fg"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        index % 3 === 0 ? "bg-sky-500" : index % 3 === 1 ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    <span>
                      {topic.topicTitle} ({topic.courseName})
                      {topic.isFromNextClass ? " - next class" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {studyMission ? (
            <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-app-teal-soft via-app-accent-soft to-app-violet-soft p-4 shadow-sm dark:border-teal-900/40">
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
                      className={`absolute left-0 top-6 z-10 w-72 rounded-lg border border-app-border bg-panel p-2 text-xs leading-relaxed text-app-fg shadow-lg ${
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
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm" data-page-guide="pulse-upcoming">
        <div className="h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-violet-500" />
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-app-accent" />
            <h3 className="text-base font-semibold text-app-fg">Coming up</h3>
          </div>
          <p className="mt-1 text-sm text-app-subtle">
            To-dos, exam dates, and class starts — alarms ring on your phone when notifications are allowed.
          </p>

          {pulseFeedLoading ? (
            <p className="mt-4 text-sm text-app-subtle">Loading your schedule…</p>
          ) : upcomingItems.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-app-border px-4 py-6 text-center text-sm text-app-subtle">
              No to-dos or exams yet. Add to-dos on a course page or exams on the Timetable.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {upcomingItems.slice(0, 8).map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 transition hover:bg-app-muted ${
                      item.overdue
                        ? "border-rose-300/60 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20"
                        : "border-app-border bg-panel"
                    }`}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-accent-soft">
                      {item.kind === "exam" ? (
                        <ClipboardList className="h-4 w-4 text-rose-600 dark:text-rose-300" />
                      ) : (
                        <CheckSquare className="h-4 w-4 text-app-accent" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-app-fg">{item.title}</span>
                        {item.hasAlarm ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-app-violet-soft px-1.5 py-0.5 text-[10px] font-medium text-app-violet">
                            <Bell className="h-3 w-3" />
                            Alarm
                          </span>
                        ) : null}
                        {item.overdue ? (
                          <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            Overdue
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-app-subtle">
                        {item.kind === "todo" ? item.courseName : item.subtitle}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-app-accent">
                        <AlarmClock className="h-3 w-3" />
                        {item.whenLabel}
                      </span>
                    </span>
                    {item.kind === "todo" ? (
                      <BookOpen className="mt-1 h-4 w-4 shrink-0 text-app-subtle" />
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {upcomingItems.length > 8 ? (
            <p className="mt-3 text-xs text-app-subtle">+ {upcomingItems.length - 8} more in the next 3 weeks</p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2" data-page-guide="pulse-classes">
        <article className="rounded-2xl border border-app-border border-l-4 border-l-sky-500 bg-panel p-5 shadow-sm">
          <p className="text-sm font-semibold text-sky-600 dark:text-sky-400">Current class</p>
          <p className="mt-1 text-base font-medium text-app-fg">{currentClassLabel}</p>
          {currentClass?.location ? (
            <p className="mt-1 text-sm text-app-subtle">Location: {currentClass.location}</p>
          ) : null}
        </article>
        <article className="rounded-2xl border border-app-border border-l-4 border-l-emerald-500 bg-panel p-5 shadow-sm">
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Next class today</p>
          <p className="mt-1 text-base font-medium text-app-fg">{nextClassLabel}</p>
        </article>
      </section>
    </div>
  );
}
