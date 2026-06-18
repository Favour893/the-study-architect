"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarRange, GraduationCap, Sparkles } from "lucide-react";
import { completeOnboarding } from "@/lib/data/semesters";
import type { GradeMode } from "@/lib/types/domain";
import { useAuth } from "@/providers/auth-provider";

type DraftCourse = {
  title: string;
  code: string;
};

const initialCourses: DraftCourse[] = [{ title: "", code: "" }];

const inputClass =
  "w-full rounded-lg border border-app-border bg-app-accent-soft/40 px-3 py-2 text-app-fg outline-none ring-app-accent transition focus:bg-panel focus:ring-2";

export function SemesterOnboarding() {
  const { user } = useAuth();
  const router = useRouter();
  const [semesterName, setSemesterName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [gradeMode, setGradeMode] = useState<GradeMode>("GPA");
  const [programmeOfStudy, setProgrammeOfStudy] = useState("");
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
        programmeOfStudy,
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
    <section className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
      <div className="h-1.5 bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500" />

      <div className="p-6 md:p-8">
        <header className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 ring-1 ring-sky-300/30">
            <GraduationCap className="h-6 w-6 text-sky-600 dark:text-sky-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-app-violet">Welcome to TSA</p>
            <h2 className="mt-0.5 text-2xl font-semibold text-app-fg">Set up your semester once.</h2>
            <p className="mt-1 text-sm text-app-subtle">
              Keep it lightweight — you can refine details as your term unfolds.
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-violet-200 bg-app-violet-soft/50 p-4 dark:border-violet-900/40">
            <div className="mb-3 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-app-violet" />
              <span className="text-sm font-semibold text-app-violet">About you</span>
            </div>
            <label className="block space-y-1">
              <span className="text-sm text-app-subtle">Programme of study</span>
              <input
                required
                value={programmeOfStudy}
                onChange={(event) => setProgrammeOfStudy(event.target.value)}
                className={inputClass}
                placeholder="e.g. BSc Computer Science, MBBS, LLB"
              />
              <span className="text-xs text-app-subtle">
                The AI uses this to make study suggestions that fit your field.
              </span>
            </label>
          </div>

          <div className="rounded-xl border border-sky-200 bg-app-accent-soft/50 p-4 dark:border-sky-900/40">
            <div className="mb-3 flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-app-accent" />
              <span className="text-sm font-semibold text-app-accent">Semester dates</span>
            </div>
            <div className="space-y-4">
              <label className="block space-y-1">
                <span className="text-sm text-app-subtle">Semester name</span>
                <input
                  required
                  value={semesterName}
                  onChange={(event) => setSemesterName(event.target.value)}
                  className={inputClass}
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
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm text-app-subtle">End date</span>
                  <input
                    required
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
            </div>
          </div>

          <fieldset className="rounded-xl border border-amber-200 bg-app-amber-soft/40 p-4 dark:border-amber-900/40">
            <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
              Grading mode
            </legend>
            <SegmentedControl
              value={gradeMode}
              onChange={setGradeMode}
              options={[
                { value: "GPA", label: "GPA" },
                { value: "CWA", label: "CWA" },
              ]}
              ariaLabel="Grading mode"
            />
          </fieldset>

          <fieldset className="rounded-xl border border-emerald-200 bg-app-success-soft/40 p-4 dark:border-emerald-900/40">
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              <BookOpen className="h-4 w-4" />
              Initial courses
            </legend>
            <div className="space-y-3">
              {courses.map((course, index) => (
                <div key={index} className="grid gap-3 sm:grid-cols-3">
                  <input
                    value={course.title}
                    onChange={(event) => updateCourse(index, "title", event.target.value)}
                    placeholder="Course title"
                    className={`${inputClass} sm:col-span-2`}
                  />
                  <input
                    value={course.code}
                    onChange={(event) => updateCourse(index, "code", event.target.value)}
                    placeholder="Code"
                    className={inputClass}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addCourseRow}
                className="rounded-lg border border-emerald-300/50 bg-panel px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
              >
                + Add another course
              </button>
            </div>
          </fieldset>

          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-app-accent via-app-violet to-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-500/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {isSubmitting ? "Saving semester..." : "Start this semester"}
          </button>
        </form>
      </div>
    </section>
  );
}
