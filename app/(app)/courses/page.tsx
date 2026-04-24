"use client";

import { useEffect, useState } from "react";
import { CourseCard } from "@/components/courses/course-card";
import { CourseForm } from "@/components/courses/course-form";
import { createCourse, listCourses } from "@/lib/data/courses";
import { createTopic, listTopics, setTopicTaughtState } from "@/lib/data/topics";
import type { Course, Topic } from "@/lib/types/domain";
import { useAuth } from "@/providers/auth-provider";
import { useSemester } from "@/providers/semester-provider";
import { useToast } from "@/providers/toast-provider";

export default function CoursesPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const { activeSemesterId, isLoading: semesterLoading } = useSemester();
  const [courses, setCourses] = useState<Course[]>([]);
  const [topicsByCourse, setTopicsByCourse] = useState<Record<string, Topic[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCourses(uid: string, semesterId: string) {
    const nextCourses = await listCourses(uid, semesterId);
    setCourses(nextCourses);

    const topicEntries = await Promise.all(
      nextCourses.map(async (course) => {
        const topics = await listTopics(uid, semesterId, course.id);
        return [course.id, topics] as const;
      }),
    );
    setTopicsByCourse(Object.fromEntries(topicEntries));
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      if (semesterLoading) {
        return;
      }

      setIsLoading(true);

      try {
        if (!activeSemesterId) {
          if (isMounted) {
            setCourses([]);
            setTopicsByCourse({});
          }
          return;
        }

        await loadCourses(user.uid, activeSemesterId);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to load courses.";
        setError(message);
        pushToast(message, "error", "courses-load");
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
  }, [user, activeSemesterId, semesterLoading, pushToast]);

  async function handleCreateCourse(payload: {
    title: string;
    code?: string;
    lecturerName?: string;
  }) {
    if (!user || !activeSemesterId) {
      return;
    }

    try {
      await createCourse(user.uid, activeSemesterId, payload);
      await loadCourses(user.uid, activeSemesterId);
    } catch {
      pushToast("Could not create course. Check your connection and try again.", "error");
    }
  }

  async function handleAddTopic(courseId: string, title: string) {
    if (!user || !activeSemesterId) {
      return;
    }

    try {
      await createTopic(user.uid, activeSemesterId, courseId, { title });
      await loadCourses(user.uid, activeSemesterId);
    } catch {
      pushToast("Could not add topic. Try again.", "error");
    }
  }

  async function handleToggleTaught(courseId: string, topicId: string, taughtInClass: boolean) {
    if (!user || !activeSemesterId) {
      return;
    }

    try {
      await setTopicTaughtState(user.uid, activeSemesterId, courseId, topicId, taughtInClass);
      await loadCourses(user.uid, activeSemesterId);
    } catch {
      pushToast("Could not update topic. Try again.", "error");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-12 animate-pulse rounded-xl bg-app-muted" />
        <div className="h-28 animate-pulse rounded-xl bg-app-muted" />
        <div className="h-28 animate-pulse rounded-xl bg-app-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="text-sm text-app-subtle">Semester vault</p>
        <h2 className="text-xl font-semibold text-app-fg">Course Cards</h2>
      </header>

      <CourseForm onCreate={handleCreateCourse} />

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-app-border bg-panel p-8 text-center">
          <p className="text-sm text-app-subtle">No courses yet. Add your first course to begin.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              topics={topicsByCourse[course.id] ?? []}
              onAddTopic={handleAddTopic}
              onToggleTaught={handleToggleTaught}
            />
          ))}
        </div>
      )}
    </div>
  );
}
