"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, ListChecks, Plus } from "lucide-react";
import { CoursePlanner } from "@/components/courses/course-planner";
import { pickCourseAccent } from "@/lib/ui/accents";
import {
  createTopic,
  listTopics,
  setTopicLearningStage,
  setTopicNotes,
  updateTopicTitle,
  type TopicLearningStage,
} from "@/lib/data/topics";
import { listCourses } from "@/lib/data/courses";
import type { Course, Topic } from "@/lib/types/domain";
import { useAuth } from "@/providers/auth-provider";
import { useSemester } from "@/providers/semester-provider";
import { useToast } from "@/providers/toast-provider";

function normalizeStage(topic: Topic): TopicLearningStage {
  if (topic.learningStage === "pending" || topic.learningStage === "taught" || topic.learningStage === "mastered") {
    return topic.learningStage;
  }
  return topic.taughtInClass ? "taught" : "pending";
}

function stageBadgeClass(stage: TopicLearningStage) {
  if (stage === "mastered") {
    return "bg-emerald-100 text-emerald-950 font-semibold dark:bg-emerald-800 dark:text-emerald-50";
  }
  if (stage === "taught") {
    return "bg-sky-100 text-sky-950 font-semibold dark:bg-sky-800 dark:text-sky-50";
  }
  return "bg-amber-100 text-amber-950 font-semibold dark:bg-amber-800 dark:text-amber-50";
}

const chipSky =
  "bg-sky-100 text-sky-950 font-semibold dark:bg-sky-800 dark:text-sky-50";
const chipViolet =
  "bg-violet-100 text-violet-950 font-semibold dark:bg-violet-800 dark:text-violet-50";
const chipEmerald =
  "bg-emerald-100 text-emerald-950 font-semibold dark:bg-emerald-800 dark:text-emerald-50";

const inputClass =
  "w-full rounded-md border border-app-border bg-app-accent-soft/30 px-3 py-2 text-sm text-app-fg outline-none ring-app-accent focus:bg-panel focus:ring-2";

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId ?? "";
  const { user } = useAuth();
  const { activeSemesterId, isLoading: semesterLoading } = useSemester();
  const { pushToast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicTitle, setTopicTitle] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async (uid: string, semesterId: string) => {
    const [courses, nextTopics] = await Promise.all([
      listCourses(uid, semesterId),
      listTopics(uid, semesterId, courseId),
    ]);
    setCourse(courses.find((item) => item.id === courseId) ?? null);
    setTopics(nextTopics);
    setNoteDrafts(Object.fromEntries(nextTopics.map((topic) => [topic.id, topic.notes ?? ""])));
    setTitleDrafts(Object.fromEntries(nextTopics.map((topic) => [topic.id, topic.title])));
  }, [courseId]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      if (!user || semesterLoading) {
        return;
      }
      if (!activeSemesterId || !courseId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        await loadData(user.uid, activeSemesterId);
      } catch {
        if (isMounted) {
          pushToast("Could not load course details.", "error");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      isMounted = false;
    };
  }, [user, activeSemesterId, semesterLoading, courseId, pushToast, loadData]);

  async function handleAddTopic(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !activeSemesterId || !topicTitle.trim()) {
      return;
    }
    setIsSaving(true);
    try {
      await createTopic(user.uid, activeSemesterId, courseId, { title: topicTitle });
      setTopicTitle("");
      await loadData(user.uid, activeSemesterId);
      pushToast("Topic added.", "success");
    } catch {
      pushToast("Could not add topic.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetStage(topicId: string, stage: TopicLearningStage) {
    if (!user || !activeSemesterId) {
      return;
    }
    try {
      await setTopicLearningStage(user.uid, activeSemesterId, courseId, topicId, stage);
      await loadData(user.uid, activeSemesterId);
      pushToast("Topic status updated.", "success");
    } catch {
      pushToast("Could not update topic status.", "error");
    }
  }

  async function handleSaveTopic(topicId: string) {
    if (!user || !activeSemesterId) {
      return;
    }
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) {
      return;
    }
    const title = (titleDrafts[topicId] ?? "").trim();
    if (!title) {
      pushToast("Topic title cannot be empty.", "error");
      return;
    }
    const notes = noteDrafts[topicId] ?? "";
    try {
      if (title !== topic.title) {
        await updateTopicTitle(user.uid, activeSemesterId, courseId, topicId, title);
      }
      if (notes !== (topic.notes ?? "")) {
        await setTopicNotes(user.uid, activeSemesterId, courseId, topicId, notes);
      }
      await loadData(user.uid, activeSemesterId);
      pushToast("Topic saved.", "success");
    } catch {
      pushToast("Could not save topic.", "error");
    }
  }

  const taughtCount = useMemo(
    () => topics.filter((topic) => normalizeStage(topic) === "taught").length,
    [topics],
  );

  const masteredCount = useMemo(
    () => topics.filter((topic) => normalizeStage(topic) === "mastered").length,
    [topics],
  );

  const courseAccent = useMemo(() => pickCourseAccent(courseId), [courseId]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
          <div className="h-1.5 animate-pulse bg-gradient-to-r from-emerald-500 via-sky-500 to-violet-500" />
          <div className="h-24 animate-pulse bg-app-accent-soft/40 p-6" />
        </div>
        <div className="h-32 animate-pulse rounded-2xl bg-app-muted" />
        <div className="h-28 animate-pulse rounded-2xl bg-app-muted" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="space-y-4 rounded-2xl border border-dashed border-app-border bg-panel p-6 text-center">
        <p className="text-sm text-app-subtle">Course not found in this semester.</p>
        <Link
          href="/courses"
          className="inline-flex items-center gap-2 rounded-lg bg-app-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to courses
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
        <div className={`h-1.5 bg-gradient-to-r ${courseAccent.bar}`} />
        <div className="p-5">
          <Link
            href="/courses"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-app-accent hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to courses
          </Link>
          <div className="flex flex-wrap items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${courseAccent.badge}`}
            >
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-app-teal">Syllabus view</p>
              <h2 className="text-xl font-semibold text-app-fg">{course.title}</h2>
              {course.code ? (
                <p className="mt-0.5 text-sm font-medium text-app-accent">{course.code}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs ${chipViolet}`}>
                  {topics.length} topic{topics.length === 1 ? "" : "s"}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs ${chipSky}`}>
                  {taughtCount} taught
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs ${chipEmerald}`}>
                  {masteredCount} mastered
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {user && activeSemesterId ? (
        <CoursePlanner
          uid={user.uid}
          semesterId={activeSemesterId}
          courseId={courseId}
          courseTitle={course.title}
        />
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm" data-page-guide="course-topics">
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-app-teal" />
        <form onSubmit={handleAddTopic} className="flex flex-wrap items-center gap-2 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100">
              <Plus className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold text-app-fg">Add topic</p>
          </div>
          <input
            value={topicTitle}
            onChange={(event) => setTopicTitle(event.target.value)}
            className={`min-w-0 flex-1 ${inputClass}`}
            placeholder="Add topic (e.g. Thermodynamics)"
          />
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-gradient-to-r from-emerald-600 to-app-teal px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-60"
          >
            {isSaving ? "Adding..." : "Add topic"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <ListChecks className="h-4 w-4 text-app-accent" />
          <h3 className="text-base font-semibold text-app-fg">Your syllabus</h3>
        </div>
        {topics.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-300 bg-app-success-soft/40 px-6 py-8 text-center dark:border-emerald-800">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
              <ListChecks className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
            </div>
            <p className="text-sm font-medium text-app-fg">No topics yet</p>
            <p className="mt-1 text-xs text-app-subtle">Add topics manually to build your syllabus.</p>
          </div>
        ) : (
          topics.map((topic) => {
            const stage = normalizeStage(topic);
            return (
              <form
                key={topic.id}
                className="overflow-hidden rounded-xl border border-app-border bg-panel shadow-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSaveTopic(topic.id);
                }}
              >
                <div className={`h-1 bg-gradient-to-r ${courseAccent.bar}`} />
                <div className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block min-w-0 flex-1 space-y-1">
                    <span className="text-xs font-medium text-app-subtle">Topic title</span>
                    <input
                      value={titleDrafts[topic.id] ?? topic.title}
                      onChange={(event) =>
                        setTitleDrafts((current) => ({ ...current, [topic.id]: event.target.value }))
                      }
                      className={`${inputClass} font-medium`}
                    />
                  </label>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${stageBadgeClass(stage)}`}
                  >
                    {stage === "pending" ? "Not started" : stage}
                  </span>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-app-subtle">Status</span>
                  <select
                    value={stage}
                    onChange={(event) => void handleSetStage(topic.id, event.target.value as TopicLearningStage)}
                    className={inputClass}
                  >
                    <option value="pending">Not Started</option>
                    <option value="taught">Taught in Class</option>
                    <option value="mastered">Mastered</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-app-subtle">Notes</span>
                  <span className="text-[11px] text-app-subtle">Enter saves · Shift+Enter for newline.</span>
                  <textarea
                    value={noteDrafts[topic.id] ?? ""}
                    onChange={(event) =>
                      setNoteDrafts((current) => ({ ...current, [topic.id]: event.target.value }))
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" || event.shiftKey) {
                        return;
                      }
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }}
                    rows={2}
                    placeholder="Add revision notes for this topic..."
                    className={inputClass}
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-md bg-app-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  Save topic
                </button>
                </div>
              </form>
            );
          })
        )}
      </section>
    </div>
  );
}
