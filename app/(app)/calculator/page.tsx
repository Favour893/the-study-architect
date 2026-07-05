"use client";

import {
  CALCULATOR_LETTER_GRADES,
  createDefaultCalculatorRows,
  isSetLetterGrade,
  loadCalculatorState,
  reconcileCalculatorRowsWithCourses,
  saveCalculatorState,
  type CalculatorRowGrade,
  type CalculatorStoredRow,
  type CalculatorStoredMode,
  type CalculatorStoredScale,
} from "@/lib/calculator-storage";
import {
  formatSemesterMark,
  countSemestersWithGrades,
  cumulativeGradedCreditsFromRowSets,
  cumulativeMarkForMode,
  roundGpaTwoDecimals,
  semesterMarkFromRows,
} from "@/lib/calculator-math";
import {
  fetchCalculatorFromFirestore,
  fetchCalculatorStateResolved,
  saveCalculatorToFirestore,
} from "@/lib/data/calculator-firestore";
import { listCourses } from "@/lib/data/courses";
import { hasFirebaseConfig } from "@/lib/firebase/client";
import type { Course } from "@/lib/types/domain";
import { useAuth } from "@/providers/auth-provider";
import { useSemester } from "@/providers/semester-provider";
import { useToast } from "@/providers/toast-provider";
import { SegmentedControl } from "@/components/ui/segmented-control";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Calculator, Sigma, TrendingUp } from "lucide-react";
import { pickCourseAccent } from "@/lib/ui/accents";

function vaultCourseLabel(course: Pick<Course, "title" | "code">) {
  return course.code?.trim() ? `${course.title} (${course.code})` : course.title;
}

type Mode = CalculatorStoredMode;
type GradeScale = CalculatorStoredScale;
type CourseRow = CalculatorStoredRow;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const inputClass =
  "rounded-md border border-app-border bg-app-accent-soft/40 px-3 py-2 text-sm text-app-fg outline-none ring-app-accent focus:bg-panel focus:ring-2";

function gradeSelectClass(grade: CalculatorRowGrade) {
  if (!grade) {
    return inputClass;
  }
  if (grade.startsWith("A")) {
    return `${inputClass} border-emerald-300 bg-emerald-50 font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300`;
  }
  if (grade.startsWith("B")) {
    return `${inputClass} border-sky-300 bg-sky-50 font-medium text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300`;
  }
  if (grade.startsWith("C")) {
    return `${inputClass} border-amber-300 bg-amber-50 font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300`;
  }
  return `${inputClass} border-rose-300 bg-rose-50 font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300`;
}

function applyDefaultCalculatorState() {
  return {
    mode: "GPA" as Mode,
    gradeScale: "5.0" as GradeScale,
    rows: createDefaultCalculatorRows(),
  };
}

export default function CalculatorPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const { activeSemesterId, semesters, isLoading: semesterLoading } = useSemester();
  const [semesterCourses, setSemesterCourses] = useState<Course[]>([]);
  const [otherSemesterRowSets, setOtherSemesterRowSets] = useState<CalculatorStoredRow[][]>([]);
  const [coursesListReady, setCoursesListReady] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const loadToken = useRef(0);
  const coursesReconcileSigRef = useRef<string | null>(null);

  const [mode, setMode] = useState<Mode>("GPA");
  const [gradeScale, setGradeScale] = useState<GradeScale>("5.0");
  const [rows, setRows] = useState<CourseRow[]>([]);

  const creditsFromCourseRows = useMemo(
    () => rows.reduce((sum, row) => sum + clamp(row.units || 0, 0, 30), 0),
    [rows],
  );

  const gradedCreditsThisSemester = useMemo(() => {
    return rows
      .filter((row) => isSetLetterGrade(row.grade))
      .reduce((sum, row) => sum + clamp(row.units || 0, 0, 30), 0);
  }, [rows]);

  const currentResult = useMemo(() => {
    const mark = semesterMarkFromRows(rows, mode, gradeScale);
    return mark ?? 0;
  }, [rows, mode, gradeScale]);

  const showCumulative = semesters.length > 1;

  const cumulativeResult = useMemo(() => {
    if (!showCumulative) {
      return null;
    }
    return cumulativeMarkForMode([...otherSemesterRowSets, rows], mode, gradeScale);
  }, [showCumulative, otherSemesterRowSets, rows, mode, gradeScale]);

  const semestersWithGrades = useMemo(() => {
    if (!showCumulative) {
      return 0;
    }
    return countSemestersWithGrades([...otherSemesterRowSets, rows]);
  }, [showCumulative, otherSemesterRowSets, rows]);

  const cumulativeGradedCredits = useMemo(() => {
    if (!showCumulative || mode !== "CWA") {
      return 0;
    }
    return cumulativeGradedCreditsFromRowSets([...otherSemesterRowSets, rows]);
  }, [showCumulative, mode, otherSemesterRowSets, rows]);

  useEffect(() => {
    if (semesterLoading) {
      return;
    }

    const token = ++loadToken.current;
    let cancelled = false;

    function applyState(next: ReturnType<typeof applyDefaultCalculatorState>) {
      setMode(next.mode);
      setGradeScale(next.gradeScale);
      setRows(next.rows);
    }

    async function hydrate() {
      setHydrated(false);

      if (!user) {
        applyState(applyDefaultCalculatorState());
        if (!cancelled && token === loadToken.current) {
          setHydrated(true);
        }
        return;
      }

      if (!activeSemesterId) {
        applyState(applyDefaultCalculatorState());
        if (!cancelled && token === loadToken.current) {
          setHydrated(true);
        }
        return;
      }

      try {
        const fromCloud = hasFirebaseConfig
          ? await fetchCalculatorFromFirestore(user.uid, activeSemesterId)
          : null;
        if (cancelled || token !== loadToken.current) {
          return;
        }

        let next = fromCloud;
        if (fromCloud) {
          saveCalculatorState(user.uid, activeSemesterId, {
            mode: fromCloud.mode,
            gradeScale: fromCloud.gradeScale,
            rows: fromCloud.rows,
            pastCredits: fromCloud.pastCredits,
            pastAverage: fromCloud.pastAverage,
            targetSemesterGpa: fromCloud.targetSemesterGpa,
          });
        } else {
          const local = loadCalculatorState(user.uid, activeSemesterId);
          if (local) {
            next = local;
            if (hasFirebaseConfig) {
              const migratedOk = await saveCalculatorToFirestore(user.uid, activeSemesterId, {
                mode: local.mode,
                gradeScale: local.gradeScale,
                rows: local.rows,
                pastCredits: local.pastCredits,
                pastAverage: local.pastAverage,
                targetSemesterGpa: local.targetSemesterGpa,
              });
              if (
                !migratedOk &&
                !cancelled &&
                token === loadToken.current
              ) {
                pushToast(
                  "Could not upload saved calculator data to the cloud. It stays on this device.",
                  "error",
                  "calculator-migrate",
                );
              }
            }
          }
        }

        if (next) {
          applyState({
            mode: next.mode,
            gradeScale: next.gradeScale,
            rows: next.rows,
          });
        } else {
          applyState(applyDefaultCalculatorState());
        }
      } catch {
        if (!cancelled && token === loadToken.current) {
          applyState(applyDefaultCalculatorState());
        }
      } finally {
        if (!cancelled && token === loadToken.current) {
          setHydrated(true);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [user, activeSemesterId, semesterLoading, pushToast]);

  useEffect(() => {
    let cancelled = false;

    async function loadSemesterCourses() {
      if (!user || !activeSemesterId || semesterLoading) {
        if (!cancelled) {
          setSemesterCourses([]);
          setCoursesListReady(false);
        }
        return;
      }
      if (!cancelled) {
        setCoursesListReady(false);
      }
      try {
        const next = await listCourses(user.uid, activeSemesterId);
        if (!cancelled) {
          setSemesterCourses(next);
        }
      } catch {
        if (!cancelled) {
          setSemesterCourses([]);
        }
      } finally {
        if (!cancelled) {
          setCoursesListReady(true);
        }
      }
    }

    void loadSemesterCourses();

    return () => {
      cancelled = true;
    };
  }, [user, activeSemesterId, semesterLoading]);

  useEffect(() => {
    let cancelled = false;

    async function loadOtherSemesterRows() {
      if (!user || semesterLoading || semesters.length <= 1) {
        if (!cancelled) {
          setOtherSemesterRowSets([]);
        }
        return;
      }

      const otherIds = semesters
        .filter((semester) => semester.id !== activeSemesterId)
        .map((semester) => semester.id);

      if (otherIds.length === 0) {
        if (!cancelled) {
          setOtherSemesterRowSets([]);
        }
        return;
      }

      try {
        const states = await Promise.all(
          otherIds.map((semesterId) => fetchCalculatorStateResolved(user.uid, semesterId)),
        );
        if (!cancelled) {
          setOtherSemesterRowSets(states.filter(Boolean).map((state) => state!.rows));
        }
      } catch {
        if (!cancelled) {
          setOtherSemesterRowSets([]);
        }
      }
    }

    void loadOtherSemesterRows();

    return () => {
      cancelled = true;
    };
  }, [user, activeSemesterId, semesterLoading, semesters]);

  useEffect(() => {
    let cancelled = false;

    function onVisible() {
      if (document.visibilityState !== "visible" || !user || !activeSemesterId || semesterLoading) {
        return;
      }
      void (async () => {
        if (!cancelled) {
          setCoursesListReady(false);
        }
        try {
          const next = await listCourses(user.uid, activeSemesterId);
          if (!cancelled) {
            setSemesterCourses(next);
          }
        } catch {
          if (!cancelled) {
            setSemesterCourses([]);
          }
        } finally {
          if (!cancelled) {
            setCoursesListReady(true);
          }
        }
      })();
    }

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, activeSemesterId, semesterLoading]);

  useEffect(() => {
    if (!hydrated || !user || !activeSemesterId || !coursesListReady) {
      return;
    }
    const sig = `${activeSemesterId}|${semesterCourses.map((c) => `${c.id}:${c.title.trim()}:${c.creditUnits ?? 3}`).join("|")}`;
    if (coursesReconcileSigRef.current === sig) {
      return;
    }
    coursesReconcileSigRef.current = sig;
    setRows((prev) =>
      reconcileCalculatorRowsWithCourses(
        prev,
        semesterCourses.map((c) => ({
          id: c.id,
          title: c.title,
          creditUnits: c.creditUnits ?? 3,
        })),
      ),
    );
  }, [hydrated, user, activeSemesterId, coursesListReady, semesterCourses]);

  useEffect(() => {
    if (!user || !activeSemesterId) {
      coursesReconcileSigRef.current = null;
    }
  }, [user, activeSemesterId]);

  useEffect(() => {
    if (!hydrated || !user || !activeSemesterId) {
      return;
    }
    const payload = {
      mode,
      gradeScale,
      rows,
      pastCredits: creditsFromCourseRows,
      pastAverage:
        mode === "GPA"
          ? roundGpaTwoDecimals(currentResult)
          : formatSemesterMark(currentResult, mode),
      targetSemesterGpa: 0,
    };
    saveCalculatorState(user.uid, activeSemesterId, payload);
    const timer = window.setTimeout(() => {
      void (async () => {
        const ok = await saveCalculatorToFirestore(user.uid, activeSemesterId, payload);
        if (!ok && hasFirebaseConfig) {
          pushToast(
            "Could not sync grade calculator to the cloud. Your entries are still saved on this device.",
            "error",
            "calculator-cloud-save",
          );
        }
      })();
    }, 750);
    return () => window.clearTimeout(timer);
  }, [
    hydrated,
    user,
    activeSemesterId,
    mode,
    gradeScale,
    rows,
    creditsFromCourseRows,
    currentResult,
    pushToast,
  ]);

  function updateRow(id: string, next: Partial<CourseRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  const isVaultSemester = Boolean(user && activeSemesterId);
  const hasVaultCourses = isVaultSemester && semesterCourses.length > 0;

  function addRow() {
    setRows((current) => [...current, { id: crypto.randomUUID(), title: "", units: 2, grade: "" }]);
  }

  function removeRow(id: string) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
  }

  if (!hydrated) {
    return (
      <div className="space-y-5">
        <div className="h-10 animate-pulse rounded-lg bg-app-accent-light" />
        <div className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
          <div className="h-1.5 animate-pulse bg-gradient-to-r from-amber-500 via-violet-500 to-emerald-500" />
          <div className="h-44 animate-pulse bg-app-accent-soft/40 p-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-violet-500 to-emerald-500" />
        <div className="flex items-start gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/50">
            <Sigma className="h-5 w-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Predictive engine</p>
            <h2 className="text-xl font-semibold text-app-fg">Grade calculator</h2>
            <p className="mt-1 text-sm text-app-subtle">
              {isVaultSemester
                ? "Credits from your Courses page. Set letter grades to see your semester average."
                : "Add courses with units and grades to calculate your semester average."}
            </p>
            {user && activeSemesterId ? (
              <p className="mt-2 text-xs text-app-subtle">
                {hasFirebaseConfig
                  ? "Synced to your account for the semester in the header."
                  : "Saved on this device for the selected semester."}
              </p>
            ) : user ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                No active semester — complete onboarding or pick one in the header.
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
        <div className="h-1 bg-gradient-to-r from-app-accent to-app-violet" />
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SegmentedControl
            value={mode}
            onChange={(next) => switchMode(next)}
            options={[
              { value: "GPA", label: "GPA" },
              { value: "CWA", label: "CWA" },
            ]}
            ariaLabel="Grade calculator mode"
          />

          {mode === "GPA" ? (
            <SegmentedControl
              value={gradeScale}
              onChange={setGradeScale}
              options={[
                { value: "5.0", label: "5.0 scale" },
                { value: "4.0", label: "4.0 scale" },
              ]}
              ariaLabel="GPA scale"
            />
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm" data-page-guide="calculator-rows">
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-sky-500" />
        <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-semibold text-app-fg">Current semester courses</h3>
          </div>
          {!isVaultSemester ? (
            <button
              type="button"
              onClick={addRow}
              className="rounded-md bg-app-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              Add course
            </button>
          ) : null}
        </div>

        {isVaultSemester && !coursesListReady ? (
          <p className="text-sm text-app-subtle">Loading courses for this semester…</p>
        ) : null}

        {isVaultSemester && coursesListReady && !hasVaultCourses ? (
          <p className="rounded-xl border border-dashed border-emerald-300 bg-app-success-soft/40 px-4 py-3 text-sm text-app-subtle dark:border-emerald-800">
            No courses in this semester yet. Add them on the{" "}
            <Link href="/courses" className="font-medium text-app-accent underline-offset-2 hover:underline">
              Courses
            </Link>{" "}
            page — they will show up here automatically.
          </p>
        ) : null}

        <div className="grid gap-2 text-xs uppercase tracking-wide text-app-subtle md:grid-cols-12">
          <p className="md:col-span-6">Course Name</p>
          <p className={isVaultSemester ? "md:col-span-3" : "md:col-span-2"}>Credit Units</p>
          <p className={isVaultSemester ? "md:col-span-3" : "md:col-span-2"}>Grade</p>
          {!isVaultSemester ? <p className="md:col-span-2" /> : null}
        </div>

        {rows.map((row) => {
          const vaultMeta = hasVaultCourses ? semesterCourses.find((c) => c.id === row.id) : undefined;
          const accent = pickCourseAccent(row.id);
          return (
            <div key={row.id} className="overflow-hidden rounded-xl border border-app-border bg-panel shadow-sm">
              <div className={`h-1 bg-gradient-to-r ${accent.bar}`} />
              <div className="grid gap-2 p-3 md:grid-cols-12">
              <div className="space-y-2 md:col-span-6">
                {!isVaultSemester ? (
                  <input
                    value={row.title}
                    onChange={(event) => updateRow(row.id, { title: event.target.value })}
                    placeholder="e.g. Engineering Mathematics 1"
                    className={`w-full ${inputClass}`}
                  />
                ) : vaultMeta ? (
                  <p className="rounded-md border border-transparent px-1 py-2 text-sm font-medium leading-snug text-app-fg">
                    {vaultCourseLabel(vaultMeta)}
                  </p>
                ) : (
                  <p className="rounded-md border border-transparent px-1 py-2 text-sm text-app-subtle">{row.title}</p>
                )}
              </div>
              {isVaultSemester ? (
                <p
                  className={`md:col-span-3 rounded-md border border-app-border px-3 py-2 text-sm ${accent.badge}`}
                >
                  {row.units} {row.units === 1 ? "credit" : "credits"}
                </p>
              ) : (
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={row.units}
                  onChange={(event) =>
                    updateRow(row.id, { units: clamp(Number(event.target.value) || 0, 0, 30) })
                  }
                  placeholder="e.g. 3"
                  className={`${isVaultSemester ? "md:col-span-2" : "md:col-span-2"} ${inputClass}`}
                />
              )}
              <select
                value={row.grade}
                onChange={(event) =>
                  updateRow(row.id, { grade: event.target.value as CalculatorRowGrade })
                }
                className={`${isVaultSemester ? "md:col-span-3" : "md:col-span-2"} ${gradeSelectClass(row.grade)}`}
                aria-label="Letter grade"
              >
                <option value="">Not set</option>
                {CALCULATOR_LETTER_GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
              {!isVaultSemester ? (
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="md:col-span-2 rounded-md border border-app-border px-3 py-2 text-sm text-app-subtle hover:bg-app-muted"
                >
                  Remove
                </button>
              ) : null}
              </div>
            </div>
          );
        })}

        <div className="overflow-hidden rounded-xl border border-app-border bg-gradient-to-br from-app-accent-soft via-app-violet-soft to-app-teal-soft shadow-sm" data-page-guide="calculator-summary">
          <div className="h-1 bg-gradient-to-r from-app-accent to-app-teal" />
          <div className="grid gap-4 px-4 py-3 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 shrink-0 text-app-accent" />
              <div>
                <p className="text-sm font-medium text-app-accent">Current semester {mode}</p>
                <p className="text-2xl font-bold text-app-fg">
                  {gradedCreditsThisSemester <= 0
                    ? "—"
                    : mode === "GPA"
                      ? roundGpaTwoDecimals(currentResult).toFixed(2)
                      : currentResult.toFixed(2)}
                </p>
                {gradedCreditsThisSemester <= 0 ? (
                  <p className="mt-0.5 text-xs text-app-subtle">
                    Grades start unset — choose a letter when you have a mark.
                  </p>
                ) : null}
              </div>
            </div>

            {showCumulative ? (
              <div className="flex items-center gap-3 border-t border-app-border/60 pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                <Sigma className="h-8 w-8 shrink-0 text-app-violet" />
                <div>
                  <p className="text-sm font-medium text-app-violet">
                    {mode === "GPA" ? "CGPA" : "Cumulative CWA"}
                  </p>
                  <p className="text-2xl font-bold text-app-fg">
                    {cumulativeResult === null
                      ? "—"
                      : mode === "GPA"
                        ? roundGpaTwoDecimals(cumulativeResult).toFixed(2)
                        : cumulativeResult.toFixed(2)}
                  </p>
                  {semestersWithGrades > 0 ? (
                    <p className="mt-0.5 text-xs text-app-subtle">
                      {mode === "GPA"
                        ? `Average of ${semestersWithGrades} semester${semestersWithGrades === 1 ? "" : "s"} with grades`
                        : `Weighted marks ÷ ${cumulativeGradedCredits} total credit${cumulativeGradedCredits === 1 ? "" : "s"}`}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-app-subtle">
                      Set letter grades in each semester to see your cumulative average.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        </div>
      </section>
    </div>
  );
}
