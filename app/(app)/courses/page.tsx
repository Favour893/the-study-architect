"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { CourseCard } from "@/components/courses/course-card";
import { CourseForm } from "@/components/courses/course-form";
import { createCourse, deleteCourse, listCourses, updateCourse } from "@/lib/data/courses";
import { createTopic } from "@/lib/data/topics";
import type { Course } from "@/lib/types/domain";
import { useAuth } from "@/providers/auth-provider";
import { useSemester } from "@/providers/semester-provider";
import { useToast } from "@/providers/toast-provider";

export default function CoursesPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const { activeSemesterId, isLoading: semesterLoading } = useSemester();
  const [courses, setCourses] = useState<Course[]>([]);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCourses(uid: string, semesterId: string) {
    const nextCourses = await listCourses(uid, semesterId);
    setCourses(nextCourses);
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

  async function handleSaveCourseEdits(
    courseId: string,
    payload: { title: string; code?: string; lecturerName?: string },
  ) {
    if (!user || !activeSemesterId) {
      return;
    }
    try {
      await updateCourse(user.uid, activeSemesterId, courseId, payload);
      await loadCourses(user.uid, activeSemesterId);
      setEditingCourseId(null);
      pushToast("Course updated.");
    } catch {
      pushToast("Could not update course. Try again.", "error");
    }
  }

  async function handleCreateSampleCourse() {
    if (!user || !activeSemesterId) {
      return;
    }
    try {
      const courseId = await createCourse(user.uid, activeSemesterId, {
        title: "Engineering Mathematics",
        code: "MTH 201",
        lecturerName: "Dr. Adaobi",
      });
      await createTopic(user.uid, activeSemesterId, courseId, { title: "Differential Equations" });
      await createTopic(user.uid, activeSemesterId, courseId, { title: "Laplace Transform" });
      await loadCourses(user.uid, activeSemesterId);
      pushToast("Sample course created.");
    } catch {
      pushToast("Could not create sample course. Try again.", "error");
    }
  }

  async function handleDeleteCourse(courseId: string) {
    if (!user || !activeSemesterId) {
      return;
    }
    try {
      await deleteCourse(user.uid, activeSemesterId, courseId);
      await loadCourses(user.uid, activeSemesterId);
      setEditingCourseId(null);
      pushToast("Course deleted.");
    } catch {
      pushToast("Could not delete course. Try again.", "error");
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
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-app-muted">
            <Sparkles className="h-6 w-6 text-app-subtle" />
          </div>
          <p className="text-sm text-app-subtle">No courses yet. Add your first course to begin.</p>
          <button
            type="button"
            onClick={() => void handleCreateSampleCourse()}
            className="mt-3 rounded-lg border border-app-border bg-white px-3 py-2 text-sm font-medium text-app-fg hover:bg-app-muted"
          >
            Add sample course
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              isEditing={editingCourseId === course.id}
              onStartEditing={setEditingCourseId}
              onCancelEditing={() => setEditingCourseId(null)}
              onSaveEdits={handleSaveCourseEdits}
              onDeleteCourse={handleDeleteCourse}
            />
          ))}
        </div>
      )}
    </div>
  );
}
