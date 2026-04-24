"use client";

import {
  CALCULATOR_LETTER_GRADES,
  createDefaultCalculatorRows,
  loadCalculatorState,
  saveCalculatorState,
  type CalculatorStoredLetter,
  type CalculatorStoredRow,
  type CalculatorStoredMode,
  type CalculatorStoredScale,
} from "@/lib/calculator-storage";
import { fetchCalculatorFromFirestore, saveCalculatorToFirestore } from "@/lib/data/calculator-firestore";
import { hasFirebaseConfig } from "@/lib/firebase/client";
import { useAuth } from "@/providers/auth-provider";
import { useSemester } from "@/providers/semester-provider";
import { useToast } from "@/providers/toast-provider";
import { useEffect, useMemo, useRef, useState } from "react";

type Mode = CalculatorStoredMode;
type GradeScale = CalculatorStoredScale;
type LetterGrade = CalculatorStoredLetter;
type CourseRow = CalculatorStoredRow;

function gradePointFromLetter(grade: LetterGrade, scale: GradeScale) {
  if (scale === "5.0") {
    const mapping: Record<LetterGrade, number> = {
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

  const mapping: Record<LetterGrade, number> = {
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

function gradeScoreEquivalent(grade: LetterGrade) {
  const mapping: Record<LetterGrade, number> = {
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

function applyDefaultCalculatorState() {
  return {
    mode: "GPA" as Mode,
    gradeScale: "5.0" as GradeScale,
    rows: createDefaultCalculatorRows(),
    pastCredits: 0,
    pastAverage: 0,
    remainingCredits: 24,
    targetFinal: 4,
  };
}

export default function CalculatorPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const { activeSemesterId, isLoading: semesterLoading } = useSemester();
  const [hydrated, setHydrated] = useState(false);
  const loadToken = useRef(0);

  const [mode, setMode] = useState<Mode>("GPA");
  const [gradeScale, setGradeScale] = useState<GradeScale>("5.0");
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [pastCredits, setPastCredits] = useState(0);
  const [pastAverage, setPastAverage] = useState(0);
  const [remainingCredits, setRemainingCredits] = useState(24);
  const [targetFinal, setTargetFinal] = useState(4);

  const scaleMax = gradeScale === "5.0" ? 5 : 4;

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
      setPastCredits(next.pastCredits);
      setPastAverage(next.pastAverage);
      setRemainingCredits(next.remainingCredits);
      setTargetFinal(next.targetFinal);
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
            remainingCredits: fromCloud.remainingCredits,
            targetFinal: fromCloud.targetFinal,
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
                remainingCredits: local.remainingCredits,
                targetFinal: local.targetFinal,
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
            pastCredits: next.pastCredits,
            pastAverage: next.pastAverage,
            remainingCredits: next.remainingCredits,
            targetFinal: next.targetFinal,
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
    if (!hydrated || !user || !activeSemesterId) {
      return;
    }
    const payload = {
      mode,
      gradeScale,
      rows,
      pastCredits,
      pastAverage,
      remainingCredits,
      targetFinal,
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
    pastCredits,
    pastAverage,
    remainingCredits,
    targetFinal,
    pushToast,
  ]);

  const currentResult = useMemo(() => {
    const totalUnits = rows.reduce((sum, row) => sum + clamp(row.units || 0, 0, 10), 0);
    if (totalUnits <= 0) {
      return 0;
    }

    if (mode === "GPA") {
      const weightedPoints = rows.reduce((sum, row) => {
        const gp = gradePointFromLetter(row.grade, gradeScale);
        return sum + gp * clamp(row.units || 0, 0, 10);
      }, 0);
      return weightedPoints / totalUnits;
    }

    const weightedScore = rows.reduce((sum, row) => {
      return sum + gradeScoreEquivalent(row.grade) * clamp(row.units || 0, 0, 10);
    }, 0);
    return weightedScore / totalUnits;
  }, [rows, mode, gradeScale]);

  const requiredFutureAverage = useMemo(() => {
    const currentTotalQuality = pastCredits * pastAverage;
    const totalCreditsAtGrad = pastCredits + remainingCredits;
    if (totalCreditsAtGrad <= 0 || remainingCredits <= 0) {
      return null;
    }

    const neededTotalQuality = targetFinal * totalCreditsAtGrad;
    return (neededTotalQuality - currentTotalQuality) / remainingCredits;
  }, [pastCredits, pastAverage, remainingCredits, targetFinal]);

  function updateRow(id: string, next: Partial<CourseRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { id: crypto.randomUUID(), title: "", units: 2, grade: "C" }]);
  }

  function removeRow(id: string) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setTargetFinal(nextMode === "GPA" ? 4 : 70);
    setPastAverage(nextMode === "GPA" ? clamp(pastAverage, 0, scaleMax) : clamp(pastAverage, 0, 100));
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
          Step 1: Add this semester&apos;s courses with units and letter grades. Step 2: use Target Forecaster to see
          what average you need for your final GPA/CWA goal.
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
          <div className="inline-flex rounded-lg bg-app-muted p-1">
            {(["GPA", "CWA"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => switchMode(item)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  item === mode ? "bg-white text-app-fg shadow-sm" : "text-app-subtle"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {mode === "GPA" ? (
            <div className="inline-flex rounded-lg bg-app-muted p-1">
              {(["5.0", "4.0"] as const).map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => setGradeScale(scale)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    gradeScale === scale ? "bg-white text-app-fg shadow-sm" : "text-app-subtle"
                  }`}
                >
                  {scale} scale
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-app-border bg-panel p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-app-fg">Current semester courses</h3>
          <button
            type="button"
            onClick={addRow}
            className="rounded-md border border-app-border bg-white px-3 py-1.5 text-sm text-app-fg hover:bg-app-muted"
          >
            Add course
          </button>
        </div>
        <div className="grid gap-2 text-xs uppercase tracking-wide text-app-subtle md:grid-cols-12">
          <p className="md:col-span-6">Course Name</p>
          <p className="md:col-span-2">Credit Units</p>
          <p className="md:col-span-2">Grade</p>
          <p className="md:col-span-2" />
        </div>

        {rows.map((row) => (
          <div key={row.id} className="grid gap-2 rounded-xl border border-app-border bg-white p-3 md:grid-cols-12">
            <input
              value={row.title}
              onChange={(event) => updateRow(row.id, { title: event.target.value })}
              placeholder="e.g. Engineering Mathematics 1"
              className="md:col-span-6 rounded-md border border-app-border px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
            />
            <input
              type="number"
              min={1}
              max={10}
              value={row.units}
              onChange={(event) => updateRow(row.id, { units: clamp(Number(event.target.value) || 0, 0, 10) })}
              placeholder="e.g. 3"
              className="md:col-span-2 rounded-md border border-app-border px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
            />
            <select
              value={row.grade}
              onChange={(event) => updateRow(row.id, { grade: event.target.value as LetterGrade })}
              className="md:col-span-2 rounded-md border border-app-border px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
            >
              {CALCULATOR_LETTER_GRADES.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              className="md:col-span-2 rounded-md border border-app-border px-3 py-2 text-sm text-app-subtle hover:bg-app-muted"
            >
              Remove
            </button>
          </div>
        ))}

        <div className="rounded-xl bg-app-muted px-4 py-3">
          <p className="text-sm text-app-subtle">Current semester {mode}</p>
          <p className="text-xl font-semibold text-app-fg">{currentResult.toFixed(2)}</p>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-app-border bg-panel p-4">
        <h3 className="text-base font-medium text-app-fg">Target forecaster</h3>
        <p className="text-sm text-app-subtle">
          Enter your existing performance and target final grade. We calculate the average needed in your remaining
          credits.
        </p>
        <div className="grid gap-2 text-xs uppercase tracking-wide text-app-subtle md:grid-cols-4">
          <p>Completed Credits</p>
          <p>Current Overall {mode}</p>
          <p>Remaining Credits</p>
          <p>Target Final {mode}</p>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <input
            type="number"
            min={0}
            value={pastCredits}
            onChange={(event) => setPastCredits(clamp(Number(event.target.value) || 0, 0, 300))}
            placeholder="e.g. 72"
            className="rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
          />
          <input
            type="number"
            min={0}
            max={mode === "GPA" ? scaleMax : 100}
            value={pastAverage}
            onChange={(event) =>
              setPastAverage(clamp(Number(event.target.value) || 0, 0, mode === "GPA" ? scaleMax : 100))
            }
            placeholder={mode === "GPA" ? `e.g. 3.65` : "e.g. 68"}
            className="rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
          />
          <input
            type="number"
            min={1}
            value={remainingCredits}
            onChange={(event) => setRemainingCredits(clamp(Number(event.target.value) || 1, 1, 300))}
            placeholder="e.g. 48"
            className="rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
          />
          <input
            type="number"
            min={0}
            max={mode === "GPA" ? scaleMax : 100}
            value={targetFinal}
            onChange={(event) =>
              setTargetFinal(clamp(Number(event.target.value) || 0, 0, mode === "GPA" ? scaleMax : 100))
            }
            placeholder={mode === "GPA" ? "e.g. 4.20" : "e.g. 75"}
            className="rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
          />
        </div>
        <div className="rounded-xl bg-app-muted px-4 py-3">
          <p className="text-sm text-app-subtle">Required average for remaining credits</p>
          <p className="text-xl font-semibold text-app-fg">
            {requiredFutureAverage === null
              ? "Add valid inputs"
              : mode === "GPA"
                ? `${requiredFutureAverage.toFixed(2)} / ${scaleMax}`
                : `${requiredFutureAverage.toFixed(2)}%`}
          </p>
          {requiredFutureAverage !== null &&
          ((mode === "GPA" && requiredFutureAverage > scaleMax) ||
            (mode === "CWA" && requiredFutureAverage > 100)) ? (
            <p className="mt-1 text-xs text-amber-700">
              Target is above achievable range with current inputs; adjust target or increase credits.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
