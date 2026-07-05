import {
  isSetLetterGrade,
  type CalculatorStoredLetter,
  type CalculatorStoredMode,
  type CalculatorStoredRow,
  type CalculatorStoredScale,
  type CalculatorStoredState,
} from "./calculator-storage";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampUnits(units: number) {
  return clamp(units || 0, 0, 30);
}

export function gradePointFromLetter(grade: CalculatorStoredLetter, scale: CalculatorStoredScale) {
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

export function gradeScoreEquivalent(grade: CalculatorStoredLetter) {
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

/** GPA values are always shown and stored with exactly two decimal places. */
export function roundGpaTwoDecimals(value: number): number {
  return Number(value.toFixed(2));
}

export type WeightedMarkParts = {
  weightedSum: number;
  gradedCredits: number;
};

/** Credit-weighted semester mark from course rows; null when no graded credits. */
export function weightedMarkPartsFromRows(
  rows: CalculatorStoredRow[],
  mode: CalculatorStoredMode,
  gradeScale: CalculatorStoredScale,
): WeightedMarkParts | null {
  const gradedRows = rows.filter((row) => isSetLetterGrade(row.grade));
  const gradedCredits = gradedRows.reduce((sum, row) => sum + clampUnits(row.units), 0);
  if (gradedCredits <= 0) {
    return null;
  }

  if (mode === "GPA") {
    const weightedSum = gradedRows.reduce((sum, row) => {
      if (!isSetLetterGrade(row.grade)) {
        return sum;
      }
      return sum + gradePointFromLetter(row.grade, gradeScale) * clampUnits(row.units);
    }, 0);
    return { weightedSum, gradedCredits };
  }

  const weightedSum = gradedRows.reduce((sum, row) => {
    if (!isSetLetterGrade(row.grade)) {
      return sum;
    }
    return sum + gradeScoreEquivalent(row.grade) * clampUnits(row.units);
  }, 0);
  return { weightedSum, gradedCredits };
}

export function semesterMarkFromRows(
  rows: CalculatorStoredRow[],
  mode: CalculatorStoredMode,
  gradeScale: CalculatorStoredScale,
): number | null {
  const parts = weightedMarkPartsFromRows(rows, mode, gradeScale);
  if (!parts) {
    return null;
  }
  return parts.weightedSum / parts.gradedCredits;
}

export function semesterMarkFromSavedState(
  state: CalculatorStoredState,
  displayMode: CalculatorStoredMode,
): number | null {
  if (state.mode !== displayMode) {
    return null;
  }
  return semesterMarkFromRows(state.rows, state.mode, state.gradeScale);
}

/** Credit-weighted cumulative mark across saved semester states (prior terms only). */
export function cumulativeMarkFromSavedStates(
  states: CalculatorStoredState[],
  displayMode: CalculatorStoredMode,
): number | null {
  let weightedSum = 0;
  let gradedCredits = 0;

  for (const state of states) {
    const parts = weightedMarkPartsFromRows(
      state.rows,
      displayMode,
      state.gradeScale,
    );
    if (!parts || state.mode !== displayMode) {
      continue;
    }
    weightedSum += parts.weightedSum;
    gradedCredits += parts.gradedCredits;
  }

  if (gradedCredits <= 0) {
    return null;
  }
  return weightedSum / gradedCredits;
}

/** Credit-weighted cumulative mark from course rows across multiple semesters. */
export function cumulativeMarkFromRowSets(
  rowSets: CalculatorStoredRow[][],
  displayMode: CalculatorStoredMode,
  gradeScale: CalculatorStoredScale,
): number | null {
  let weightedSum = 0;
  let gradedCredits = 0;

  for (const rows of rowSets) {
    const parts = weightedMarkPartsFromRows(rows, displayMode, gradeScale);
    if (!parts) {
      continue;
    }
    weightedSum += parts.weightedSum;
    gradedCredits += parts.gradedCredits;
  }

  if (gradedCredits <= 0) {
    return null;
  }
  return weightedSum / gradedCredits;
}

/** CGPA: arithmetic mean of each semester's GPA. */
export function cumulativeCgpaFromRowSets(
  rowSets: CalculatorStoredRow[][],
  gradeScale: CalculatorStoredScale,
): number | null {
  const semesterMarks = rowSets
    .map((rows) => semesterMarkFromRows(rows, "GPA", gradeScale))
    .filter((mark): mark is number => mark !== null);

  if (semesterMarks.length === 0) {
    return null;
  }

  return semesterMarks.reduce((sum, mark) => sum + mark, 0) / semesterMarks.length;
}

/** @deprecated Use cumulativeCgpaFromRowSets for GPA cumulative marks. */
export function cumulativeMarkAsSemesterAverage(
  rowSets: CalculatorStoredRow[][],
  displayMode: CalculatorStoredMode,
  gradeScale: CalculatorStoredScale,
): number | null {
  if (displayMode !== "GPA") {
    return null;
  }
  return cumulativeCgpaFromRowSets(rowSets, gradeScale);
}

/**
 * Cumulative CWA (KNUST-style): Σ(mark × credit hours) ÷ Σ(credit hours)
 * across all courses in all semesters — not an average of semester CWAs.
 */
export function cumulativeCwaFromRowSets(rowSets: CalculatorStoredRow[][]): number | null {
  return cumulativeMarkFromRowSets(rowSets, "CWA", "5.0");
}

export function cumulativeMarkForMode(
  rowSets: CalculatorStoredRow[][],
  mode: CalculatorStoredMode,
  gradeScale: CalculatorStoredScale,
): number | null {
  if (mode === "GPA") {
    return cumulativeCgpaFromRowSets(rowSets, gradeScale);
  }
  return cumulativeCwaFromRowSets(rowSets);
}

export function countSemestersWithGrades(rowSets: CalculatorStoredRow[][]): number {
  return rowSets.filter((rows) => rows.some((row) => isSetLetterGrade(row.grade))).length;
}

export function cumulativeGradedCreditsFromRowSets(rowSets: CalculatorStoredRow[][]): number {
  let total = 0;
  for (const rows of rowSets) {
    const parts = weightedMarkPartsFromRows(rows, "CWA", "5.0");
    if (parts) {
      total += parts.gradedCredits;
    }
  }
  return total;
}

export function formatSemesterMark(mark: number, mode: CalculatorStoredMode): number {
  return mode === "GPA" ? roundGpaTwoDecimals(mark) : Number(mark.toFixed(2));
}
