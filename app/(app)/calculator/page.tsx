"use client";

import {
  CALCULATOR_LETTER_GRADES,
  createDefaultCalculatorRows,
  isSetLetterGrade,
  loadCalculatorState,
  reconcileCalculatorRowsWithCourses,
  saveCalculatorState,
  type CalculatorRowGrade,
  type CalculatorStoredLetter,
  type CalculatorStoredRow,
  type CalculatorStoredMode,
  type CalculatorStoredScale,
  type CalculatorStoredState,
} from "@/lib/calculator-storage";
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

function vaultCourseLabel(course: Pick<Course, "title" | "code">) {
  return course.code?.trim() ? `${course.title} (${course.code})` : course.title;
}

type Mode = CalculatorStoredMode;
type GradeScale = CalculatorStoredScale;
type CourseRow = CalculatorStoredRow;

function gradePointFromLetter(grade: CalculatorStoredLetter, scale: GradeScale) {
  if (scale === "5.0") {
    const mapping: Record<CalculatorStoredLetter, number> = {
      A: 5,
      "B+": 4.5,
      B: 4,
      "C+": 3.5,
      C: 3,
      "D+": 2.5,
      D: 2,
      E: 1,
      F: 0,
    };
    return mapping[grade];
  }

  const mapping: Record<CalculatorStoredLetter, number> = {
    A: 4,
    "B+": 3.5,
    B: 3,
    "C+": 2.5,
    C: 2,
    "D+": 1.5,
    D: 1,
    E: 0.5,
    F: 0,
  };
  return mapping[grade];
}

function gradeScoreEquivalent(grade: CalculatorStoredLetter) {
  const mapping: Record<CalculatorStoredLetter, number> = {
    A: 85,
    "B+": 75,
    B: 65,
    "C+": 57,
    C: 52,
    "D+": 47,
    D: 42,
    E: 35,
    F: 20,
  };
  return mapping[grade];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** GPA values are always shown and stored with exactly two decimal places. */
function roundGpaTwoDecimals(value: number): number {
  return Number(value.toFixed(2));
}

function priorMarkFromSavedState(state: CalculatorStoredState, displayMode: Mode): number | null {
  if (state.mode !== displayMode) {
    return null;
  }
  const hasGrades = state.rows.some((r) => isSetLetterGrade(r.grade));
  if (!hasGrades) {
    return null;
  }
  const pa = state.pastAverage;
  if (typeof pa !== "number" || Number.isNaN(pa)) {
    return null;
  }
  return displayMode === "GPA" ? roundGpaTwoDecimals(pa) : Number(pa.toFixed(2));
}

function suggestedLetterForSemesterTarget(target: number, scale: GradeScale): CalculatorStoredLetter {
  let best: CalculatorStoredLetter = "C";
  let bestDiff = Infinity;
  for (const letter of CALCULATOR_LETTER_GRADES) {
    const p = gradePointFromLetter(letter, scale);
    const d = Math.abs(p - target);
    if (d < bestDiff) {
      bestDiff = d;
      best = letter;
    }
  }
  return best;
}

function applyDefaultCalculatorState() {
  return {
    mode: "GPA" as Mode,
    gradeScale: "5.0" as GradeScale,
    rows: createDefaultCalculatorRows(),
    targetSemesterGpa: 4,
  };
}

export default function CalculatorPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const { activeSemesterId, semesters, isLoading: semesterLoading } = useSemester();
  const [semesterCourses, setSemesterCourses] = useState<Course[]>([]);
  const [coursesListReady, setCoursesListReady] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const loadToken = useRef(0);
  const coursesReconcileSigRef = useRef<string | null>(null);

  const [mode, setMode] = useState<Mode>("GPA");
  const [gradeScale, setGradeScale] = useState<GradeScale>("5.0");
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [targetSemesterGpa, setTargetSemesterGpa] = useState(4);
  const [targetGpaText, setTargetGpaText] = useState("4");
  const [priorSnapshotMarks, setPriorSnapshotMarks] = useState<number[]>([]);
  const [priorSnapshotsLoading, setPriorSnapshotsLoading] = useState(false);

  const scaleMax = gradeScale === "5.0" ? 5 : 4;

  const activeSemesterName = useMemo(() => {
    if (!activeSemesterId) {
      return "this semester";
    }
    return semesters.find((s) => s.id === activeSemesterId)?.name ?? "this semester";
  }, [activeSemesterId, semesters]);

  const priorSemesters = useMemo(() => {
    if (!activeSemesterId) {
      return semesters;
    }
    return semesters.filter((s) => s.id !== activeSemesterId);
  }, [semesters, activeSemesterId]);

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
    const gradedRows = rows.filter((row) => isSetLetterGrade(row.grade));
    const totalUnits = gradedRows.reduce((sum, row) => sum + clamp(row.units || 0, 0, 30), 0);
    if (totalUnits <= 0) {
      return 0;
    }

    if (mode === "GPA") {
      const weightedPoints = gradedRows.reduce((sum, row) => {
        if (!isSetLetterGrade(row.grade)) {
          return sum;
        }
        const gp = gradePointFromLetter(row.grade, gradeScale);
        return sum + gp * clamp(row.units || 0, 0, 30);
      }, 0);
      return weightedPoints / totalUnits;
    }

    const weightedScore = gradedRows.reduce((sum, row) => {
      if (!isSetLetterGrade(row.grade)) {
        return sum;
      }
      return sum + gradeScoreEquivalent(row.grade) * clamp(row.units || 0, 0, 30);
    }, 0);
    return weightedScore / totalUnits;
  }, [rows, mode, gradeScale]);

  const cumulativeForecasterMark = useMemo(() => {
    if (priorSemesters.length === 0) {
      if (gradedCreditsThisSemester <= 0) {
        return null;
      }
      return mode === "GPA" ? roundGpaTwoDecimals(currentResult) : Number(currentResult.toFixed(2));
    }
    if (priorSnapshotMarks.length === 0) {
      return null;
    }
    const sum = priorSnapshotMarks.reduce((a, b) => a + b, 0);
    return mode === "GPA"
      ? roundGpaTwoDecimals(sum / priorSnapshotMarks.length)
      : Number((sum / priorSnapshotMarks.length).toFixed(2));
  }, [
    priorSemesters.length,
    priorSnapshotMarks,
    mode,
    currentResult,
    gradedCreditsThisSemester,
  ]);

  useEffect(() => {
    if (!user || priorSemesters.length === 0) {
      setPriorSnapshotMarks([]);
      setPriorSnapshotsLoading(false);
      return;
    }

    let cancelled = false;
    setPriorSnapshotsLoading(true);

    void Promise.all(
      priorSemesters.map((s) => fetchCalculatorStateResolved(user.uid, s.id)),
    ).then((list) => {
      if (cancelled) {
        return;
      }
      const marks: number[] = [];
      for (const st of list) {
        if (!st) {
          continue;
        }
        const m = priorMarkFromSavedState(st, mode);
        if (m !== null) {
          marks.push(m);
        }
      }
      setPriorSnapshotMarks(marks);
      setPriorSnapshotsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user, priorSemesters, mode]);

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
      setTargetSemesterGpa(
        next.mode === "GPA"
          ? roundGpaTwoDecimals(next.targetSemesterGpa)
          : next.targetSemesterGpa,
      );
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
            targetSemesterGpa: next.targetSemesterGpa,
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
      pastAverage: mode === "GPA" ? roundGpaTwoDecimals(currentResult) : currentResult,
      targetSemesterGpa: mode === "GPA" ? roundGpaTwoDecimals(targetSemesterGpa) : targetSemesterGpa,
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
    targetSemesterGpa,
    pushToast,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (mode === "GPA") {
        setTargetGpaText(
          targetSemesterGpa <= 0 ? "" : String(roundGpaTwoDecimals(targetSemesterGpa)),
        );
      } else {
        setTargetGpaText(targetSemesterGpa <= 0 ? "" : String(Math.round(targetSemesterGpa)));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [targetSemesterGpa, mode, activeSemesterId]);

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
    setTargetSemesterGpa(nextMode === "GPA" ? 4 : 70);
  }

  function commitTargetGpaText() {
    const trimmed = targetGpaText.trim();
    if (trimmed === "") {
      setTargetSemesterGpa(0);
      setTargetGpaText("");
      return;
    }
    const n = Number.parseFloat(trimmed.replace(",", "."));
    if (Number.isNaN(n)) {
      setTargetGpaText(
        targetSemesterGpa <= 0
          ? ""
          : mode === "GPA"
            ? String(roundGpaTwoDecimals(targetSemesterGpa))
            : String(Math.round(targetSemesterGpa)),
      );
      return;
    }
    const c = clamp(n, 0, mode === "GPA" ? scaleMax : 100);
    const rounded = mode === "GPA" ? roundGpaTwoDecimals(c) : Number(c.toFixed(2));
    setTargetSemesterGpa(rounded);
    setTargetGpaText(mode === "GPA" ? String(rounded) : String(Math.round(rounded)));
  }

  if (!hydrated) {
    return (
      <div className="space-y-5">
        <header className="space-y-1">
          <p className="text-sm text-app-subtle">Predictive Engine</p>
          <h2 className="text-xl font-semibold text-app-fg">Grade Calculator</h2>
        </header>
        <div className="h-44 animate-pulse rounded-2xl bg-app-muted" />
        <div className="h-52 animate-pulse rounded-2xl bg-app-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-sm text-app-subtle">Predictive Engine</p>
        <h2 className="text-xl font-semibold text-app-fg">Grade Calculator</h2>
        <p className="text-sm text-app-subtle">
          {isVaultSemester
            ? "Credits come from each course on the Courses page. Grades start unset until you enter them. Use Target forecaster for cumulative GPA, semester goal, and a study plan."
            : "Step 1: Add courses with units and letter grades. Step 2: Use Target forecaster for cumulative GPA and your semester goal."}
        </p>
        {user && activeSemesterId ? (
          <p className="text-xs text-app-subtle">
            {hasFirebaseConfig
              ? "Synced to your account and saved on this device for the semester selected in the header."
              : "Saved on this device for the semester selected in the header (add Firebase env vars to sync to the cloud)."}
          </p>
        ) : user ? (
          <p className="text-xs text-amber-800">
            No active semester yet, so entries are not tied to a semester vault. Complete onboarding or pick a semester
            in the header.
          </p>
        ) : null}
      </header>

      <section className="rounded-2xl border border-app-border bg-panel p-4">
        <div className="flex flex-wrap items-center gap-3">
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

      <section className="space-y-3 rounded-2xl border border-app-border bg-panel p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-app-fg">Current semester courses</h3>
          {!isVaultSemester ? (
            <button
              type="button"
              onClick={addRow}
              className="rounded-md border border-app-border bg-white px-3 py-1.5 text-sm text-app-fg hover:bg-app-muted"
            >
              Add course
            </button>
          ) : null}
        </div>

        {isVaultSemester && !coursesListReady ? (
          <p className="text-sm text-app-subtle">Loading courses for this semester…</p>
        ) : null}

        {isVaultSemester && coursesListReady && !hasVaultCourses ? (
          <p className="rounded-xl border border-dashed border-app-border bg-white px-4 py-3 text-sm text-app-subtle">
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
          return (
            <div key={row.id} className="grid gap-2 rounded-xl border border-app-border bg-white p-3 md:grid-cols-12">
              <div className="space-y-2 md:col-span-6">
                {!isVaultSemester ? (
                  <input
                    value={row.title}
                    onChange={(event) => updateRow(row.id, { title: event.target.value })}
                    placeholder="e.g. Engineering Mathematics 1"
                    className="w-full rounded-md border border-app-border px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
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
                  className={`md:col-span-3 rounded-md border border-app-border bg-app-muted px-3 py-2 text-sm text-app-fg`}
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
                  className={`${isVaultSemester ? "md:col-span-3" : "md:col-span-2"} rounded-md border border-app-border px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2`}
                />
              )}
              <select
                value={row.grade}
                onChange={(event) =>
                  updateRow(row.id, { grade: event.target.value as CalculatorRowGrade })
                }
                className={`${isVaultSemester ? "md:col-span-3" : "md:col-span-2"} rounded-md border border-app-border px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2`}
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
          );
        })}

        <div className="rounded-xl bg-app-muted px-4 py-3">
          <p className="text-sm text-app-subtle">Current semester {mode}</p>
          <p className="text-xl font-semibold text-app-fg">
            {gradedCreditsThisSemester <= 0
              ? "—"
              : mode === "GPA"
                ? roundGpaTwoDecimals(currentResult).toFixed(2)
                : currentResult.toFixed(2)}
          </p>
          {gradedCreditsThisSemester <= 0 ? (
            <p className="mt-1 text-xs text-app-subtle">
              Grades start unset for a new term — choose a letter when you have a mark.
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-app-border bg-panel p-4">
        <h3 className="text-base font-medium text-app-fg">Target forecaster</h3>
        <p className="text-sm text-app-subtle">
          Credits match your Courses page. Cumulative {mode} uses saved calculator data from other terms (same{" "}
          {mode} mode). When this is your first term, it matches your current-semester average above. Set your target for{" "}
          <span className="font-medium text-app-fg">{activeSemesterName}</span> by typing in the field (no spinner
          arrows). We then build a per-course study plan.
        </p>
        <div className="grid gap-2 text-xs uppercase tracking-wide text-app-subtle md:grid-cols-3">
          <p>Credits (from courses above)</p>
          <p>Cumulative {mode}</p>
          <p>
            Target {mode} for {activeSemesterName}
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            type="number"
            min={0}
            readOnly
            tabIndex={-1}
            value={creditsFromCourseRows}
            aria-readonly="true"
            className="cursor-default rounded-md border border-app-border bg-app-muted px-3 py-2 text-sm text-app-fg outline-none"
          />
          <div
            className="flex flex-col justify-center rounded-md border border-app-border bg-app-muted px-3 py-2 text-sm text-app-fg"
            title={
              priorSemesters.length === 0
                ? "First term: same as current semester average when you have grades"
                : "Average of saved prior-term calculator snapshots (current term excluded)"
            }
          >
            <span className="text-lg font-semibold leading-tight">
              {priorSnapshotsLoading && priorSemesters.length > 0
                ? "…"
                : cumulativeForecasterMark === null
                  ? "—"
                  : cumulativeForecasterMark.toFixed(2)}
            </span>
            <span className="text-[11px] font-normal normal-case tracking-normal text-app-subtle">
              {priorSnapshotsLoading && priorSemesters.length > 0
                ? "Loading other terms…"
                : priorSemesters.length === 0
                  ? gradedCreditsThisSemester <= 0
                    ? "First term — add grades above"
                    : "This term only"
                  : cumulativeForecasterMark === null
                    ? `No saved ${mode} in ${priorSemesters.length} prior term${priorSemesters.length === 1 ? "" : "s"}`
                    : `Across ${priorSnapshotMarks.length} prior term${priorSnapshotMarks.length === 1 ? "" : "s"} with grades`}
            </span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={targetGpaText}
            onChange={(event) => setTargetGpaText(event.target.value)}
            onBlur={() => commitTargetGpaText()}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }
              event.preventDefault();
              commitTargetGpaText();
            }}
            placeholder={mode === "GPA" ? "e.g. 3.96" : "e.g. 75"}
            className="rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
          />
        </div>

        {mode === "GPA" && hasVaultCourses && targetSemesterGpa > 0 ? (
          <div className="space-y-3 rounded-xl border border-app-border bg-white px-4 py-3">
            <h4 className="text-sm font-medium text-app-fg">Study plan ({activeSemesterName})</h4>
            <p className="text-xs text-app-subtle">
              To land near a <span className="font-medium text-app-fg">{targetSemesterGpa.toFixed(2)}</span> semester GPA
              on the {gradeScale} scale, aim for at least the suggested letter in each course (equal weight per credit).
              Spend weekly prep time roughly in proportion to credits — heavier courses need more calendar blocks.
            </p>
            <ul className="space-y-2">
              {semesterCourses.map((c) => {
                const suggestion = suggestedLetterForSemesterTarget(targetSemesterGpa, gradeScale);
                const credits = c.creditUnits ?? 3;
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-app-border bg-app-muted px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-app-fg">{vaultCourseLabel(c)}</span>
                    <span className="text-app-subtle">
                      {credits} cr · aim ≥ <span className="font-semibold text-app-fg">{suggestion}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : mode === "CWA" && hasVaultCourses && targetSemesterGpa > 0 ? (
          <div className="space-y-2 rounded-xl border border-app-border bg-white px-4 py-3">
            <h4 className="text-sm font-medium text-app-fg">Study plan ({activeSemesterName})</h4>
            <p className="text-xs text-app-subtle">
              Target semester CWA <span className="font-medium text-app-fg">{targetSemesterGpa.toFixed(2)}%</span>. Work
              toward that average across courses; prioritize weekly time by credit load.
            </p>
            <ul className="space-y-2">
              {semesterCourses.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-app-border bg-app-muted px-3 py-2 text-sm text-app-fg"
                >
                  {vaultCourseLabel(c)} · {c.creditUnits ?? 3} credits
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
