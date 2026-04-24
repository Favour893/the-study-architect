"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/lib/data/semesters";
import type { GradeMode } from "@/lib/types/domain";
import { useAuth } from "@/providers/auth-provider";

type DraftCourse = {
  title: string;
  code: string;
};

const initialCourses: DraftCourse[] = [{ title: "", code: "" }];

export function SemesterOnboarding() {
  const { user } = useAuth();
  const router = useRouter();
  const [semesterName, setSemesterName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [gradeMode, setGradeMode] = useState<GradeMode>("GPA");
  const [courses, setCourses] = useState<DraftCourse[]>(initialCourses);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateCourse(index: number, field: keyof DraftCourse, value: string) {
    setCourses((currentCourses) =>
      currentCourses.map((course, currentIndex) =>
        currentIndex === index ? { ...course, [field]: value } : course,
      ),
    );
  }

  function addCourseRow() {
    setCourses((currentCourses) => [...currentCourses, { title: "", code: "" }]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!user) {
      setError("You must be signed in.");
      return;
    }

    setIsSubmitting(true);
    try {
      await completeOnboarding(user.uid, {
        semesterName,
        startDate,
        endDate,
        gradeMode,
        courses,
        email: user.email,
        displayName: user.displayName,
      });
      router.replace("/dashboard");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not complete onboarding.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-app-border bg-panel p-6 md:p-8">
      <header className="mb-6 space-y-2">
        <p className="text-sm uppercase tracking-wide text-app-subtle">Welcome to TSA</p>
        <h2 className="text-2xl font-semibold text-app-fg">Set up your semester once.</h2>
        <p className="text-sm text-app-subtle">
          Keep it lightweight. You can refine details later as your semester unfolds.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block space-y-1">
          <span className="text-sm text-app-subtle">Semester name</span>
          <input
            required
            value={semesterName}
            onChange={(event) => setSemesterName(event.target.value)}
            className="w-full rounded-lg border border-app-border bg-white px-3 py-2 outline-none ring-app-accent transition focus:ring-2"
            placeholder="Harmattan 2026"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm text-app-subtle">Start date</span>
            <input
              required
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-lg border border-app-border bg-white px-3 py-2 outline-none ring-app-accent transition focus:ring-2"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-app-subtle">End date</span>
            <input
              required
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-lg border border-app-border bg-white px-3 py-2 outline-none ring-app-accent transition focus:ring-2"
            />
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm text-app-subtle">Grading mode</legend>
          <div className="inline-flex rounded-lg bg-app-muted p-1">
            {(["GPA", "CWA"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setGradeMode(mode)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  gradeMode === mode ? "bg-white text-app-fg shadow-sm" : "text-app-subtle"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm text-app-subtle">Initial courses</legend>
          {courses.map((course, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-3">
              <input
                value={course.title}
                onChange={(event) => updateCourse(index, "title", event.target.value)}
                placeholder="Course title"
                className="sm:col-span-2 rounded-lg border border-app-border bg-white px-3 py-2 outline-none ring-app-accent transition focus:ring-2"
              />
              <input
                value={course.code}
                onChange={(event) => updateCourse(index, "code", event.target.value)}
                placeholder="Code"
                className="rounded-lg border border-app-border bg-white px-3 py-2 outline-none ring-app-accent transition focus:ring-2"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addCourseRow}
            className="rounded-lg border border-app-border bg-white px-3 py-2 text-sm text-app-fg hover:bg-app-muted"
          >
            Add another course
          </button>
        </fieldset>

        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-app-fg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Saving semester..." : "Start this semester"}
        </button>
      </form>
    </section>
  );
}
