"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createTopic,
  listTopics,
  setTopicLearningStage,
  setTopicNotes,
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
    } catch {
      pushToast("Could not update topic status.", "error");
    }
  }

  async function handleSaveNotes(topicId: string) {
    if (!user || !activeSemesterId) {
      return;
    }
    const notes = noteDrafts[topicId] ?? "";
    try {
      await setTopicNotes(user.uid, activeSemesterId, courseId, topicId, notes);
      await loadData(user.uid, activeSemesterId);
      pushToast("Topic notes saved.");
    } catch {
      pushToast("Could not save topic notes.", "error");
    }
  }

  const taughtCount = useMemo(
    () => topics.filter((topic) => normalizeStage(topic) === "taught").length,
    [topics],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-12 animate-pulse rounded-xl bg-app-muted" />
        <div className="h-28 animate-pulse rounded-xl bg-app-muted" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-app-subtle">Course not found in this semester.</p>
        <Link href="/courses" className="inline-flex rounded-md border border-app-border bg-white px-3 py-2 text-sm text-app-fg">
          Back to courses
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="text-sm text-app-subtle">Syllabus view</p>
        <h2 className="text-xl font-semibold text-app-fg">{course.title}</h2>
        <p className="text-sm text-app-subtle">
          Topics: {topics.length} total, {taughtCount} taught and waiting for mastery.
        </p>
      </header>

      <form onSubmit={handleAddTopic} className="flex gap-2 rounded-xl border border-app-border bg-panel p-3">
        <input
          value={topicTitle}
          onChange={(event) => setTopicTitle(event.target.value)}
          className="w-full rounded-lg border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
          placeholder="Add topic (e.g. Thermodynamics)"
        />
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg border border-app-border bg-white px-3 py-2 text-sm font-medium text-app-fg hover:bg-app-muted disabled:opacity-60"
        >
          {isSaving ? "Adding..." : "Add topic"}
        </button>
      </form>

      <div className="space-y-2">
        {topics.length === 0 ? (
          <p className="text-sm text-app-subtle">No topics yet.</p>
        ) : (
          topics.map((topic) => {
            const stage = normalizeStage(topic);
            return (
              <div key={topic.id} className="space-y-2 rounded-xl border border-app-border bg-panel p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-app-fg">{topic.title}</p>
                  <span className="rounded-full bg-app-muted px-2 py-0.5 text-xs text-app-subtle">{stage}</span>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs text-app-subtle">Status</span>
                  <select
                    value={stage}
                    onChange={(event) => void handleSetStage(topic.id, event.target.value as TopicLearningStage)}
                    className="w-full rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
                  >
                    <option value="pending">Not Started</option>
                    <option value="taught">Taught in Class</option>
                    <option value="mastered">Mastered</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-app-subtle">Notes</span>
                  <textarea
                    value={noteDrafts[topic.id] ?? ""}
                    onChange={(event) =>
                      setNoteDrafts((current) => ({ ...current, [topic.id]: event.target.value }))
                    }
                    rows={2}
                    placeholder="Add revision notes for this topic..."
                    className="w-full rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleSaveNotes(topic.id)}
                  className="rounded-md border border-app-border bg-white px-3 py-1.5 text-sm text-app-fg hover:bg-app-muted"
                >
                  Save notes
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
