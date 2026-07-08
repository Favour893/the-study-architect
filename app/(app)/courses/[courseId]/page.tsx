"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { CoursePlanner } from "@/components/courses/course-planner";
import { pickCourseAccent } from "@/lib/ui/accents";
import { listCourses } from "@/lib/data/courses";
import type { Course } from "@/lib/types/domain";
import { useAuth } from "@/providers/auth-provider";
import { useSemester } from "@/providers/semester-provider";
import { useToast } from "@/providers/toast-provider";

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId ?? "";
  const { user } = useAuth();
  const { activeSemesterId, isLoading: semesterLoading } = useSemester();
  const { pushToast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async (uid: string, semesterId: string) => {
    const courses = await listCourses(uid, semesterId);
    setCourse(courses.find((item) => item.id === courseId) ?? null);
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

  const courseAccent = useMemo(() => pickCourseAccent(courseId), [courseId]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
          <div className="h-1.5 animate-pulse bg-gradient-to-r from-emerald-500 via-sky-500 to-violet-500" />
          <div className="h-24 animate-pulse bg-app-accent-soft/40 p-6" />
        </div>
        <div className="h-32 animate-pulse rounded-2xl bg-app-muted" />
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
              <p className="text-sm font-semibold text-app-teal">Course</p>
              <h2 className="text-xl font-semibold text-app-fg">{course.title}</h2>
              {course.code ? (
                <p className="mt-0.5 text-sm font-medium text-app-accent">{course.code}</p>
              ) : null}
              {course.lecturerName ? (
                <p className="mt-1 text-sm text-app-subtle">Lecturer: {course.lecturerName}</p>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {user && activeSemesterId ? (
        <CoursePlanner uid={user.uid} semesterId={activeSemesterId} courseId={courseId} />
      ) : null}
    </div>
  );
}
