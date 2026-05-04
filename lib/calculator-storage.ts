export const CALCULATOR_STORAGE_VERSION = 1 as const;

export type CalculatorStoredMode = "GPA" | "CWA";
export type CalculatorStoredScale = "5.0" | "4.0";
export type CalculatorStoredLetter =
  | "A"
  | "B+"
  | "B"
  | "C+"
  | "C"
  | "D+"
  | "D"
  | "E"
  | "F";

/** Letter grade or empty when the user has not entered a grade yet. */
export type CalculatorRowGrade = CalculatorStoredLetter | "";

export type CalculatorStoredRow = {
  id: string;
  /** Firestore course doc id when this row is tied to the semester vault (Courses page). */
  courseId?: string;
  title: string;
  units: number;
  grade: CalculatorRowGrade;
};

export type CalculatorStoredState = {
  v: typeof CALCULATOR_STORAGE_VERSION;
  mode: CalculatorStoredMode;
  gradeScale: CalculatorStoredScale;
  rows: CalculatorStoredRow[];
  pastCredits: number;
  pastAverage: number;
  targetSemesterGpa: number;
};

export const CALCULATOR_LETTER_GRADES: CalculatorStoredLetter[] = [
  "A",
  "B+",
  "B",
  "C+",
  "C",
  "D+",
  "D",
  "E",
  "F",
];

const LETTER_SET = new Set<CalculatorStoredLetter>(CALCULATOR_LETTER_GRADES);

export function isSetLetterGrade(g: CalculatorRowGrade): g is CalculatorStoredLetter {
  return g !== "";
}

export function parseRowGrade(value: unknown): CalculatorRowGrade {
  if (value === "" || value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string" && LETTER_SET.has(value as CalculatorStoredLetter)) {
    return value as CalculatorStoredLetter;
  }
  return "";
}

export function calculatorLocalStorageKey(uid: string, semesterId: string) {
  return `tsa.calculator.v1:${uid}:${semesterId}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampCourseUnits(n: number): number {
  return Math.min(30, Math.max(1, Math.round(n)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRow(value: unknown): CalculatorStoredRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = typeof value.id === "string" && value.id.length > 0 ? value.id : crypto.randomUUID();
  const title = typeof value.title === "string" ? value.title : "";
  const units = clamp(Number(value.units) || 0, 0, 30);
  const courseId =
    typeof value.courseId === "string" && value.courseId.length > 0 ? value.courseId : undefined;
  const row: CalculatorStoredRow = { id, title, units, grade: parseRowGrade(value.grade) };
  if (courseId) {
    row.courseId = courseId;
  }
  return row;
}

/** Course row from the vault with credit units for reconciling calculator rows. */
export type CalculatorSemesterCourseRef = {
  id: string;
  title: string;
  creditUnits: number;
};

/**
 * One calculator row per semester course, same order as `courses`.
 * Units come from the course card. Grades default to unset until the user picks a letter.
 */
export function reconcileCalculatorRowsWithCourses(
  prevRows: CalculatorStoredRow[],
  courses: CalculatorSemesterCourseRef[],
): CalculatorStoredRow[] {
  if (courses.length === 0) {
    return [];
  }

  const byCourseId = new Map<string, CalculatorStoredRow>();
  const byTitleNorm = new Map<string, CalculatorStoredRow>();

  for (const row of prevRows) {
    if (row.courseId) {
      byCourseId.set(row.courseId, row);
      continue;
    }
    const tn = row.title.trim().toLowerCase();
    if (tn && !byTitleNorm.has(tn)) {
      byTitleNorm.set(tn, row);
    }
  }

  return courses.map((course) => {
    const fromId = byCourseId.get(course.id);
    const titleNorm = course.title.trim().toLowerCase();
    const fromTitle = fromId ? undefined : byTitleNorm.get(titleNorm);
    const pick = fromId ?? fromTitle;

    const units = clampCourseUnits(
      typeof course.creditUnits === "number" && course.creditUnits > 0 ? course.creditUnits : 3,
    );

    const grade = pick ? parseRowGrade(pick.grade) : "";

    return {
      id: course.id,
      courseId: course.id,
      title: course.title.trim(),
      units,
      grade,
    };
  });
}

export function createDefaultCalculatorRows(): CalculatorStoredRow[] {
  return [
    { id: crypto.randomUUID(), title: "", units: 3, grade: "" },
    { id: crypto.randomUUID(), title: "", units: 2, grade: "" },
  ];
}

export function calculatorStateFromRemotePayload(data: unknown): CalculatorStoredState | null {
  if (!isRecord(data)) {
    return null;
  }
  const rest = { ...data };
  delete rest.updatedAt;
  delete rest.createdAt;
  return parseCalculatorStoredState({ v: CALCULATOR_STORAGE_VERSION, ...rest });
}

export function parseCalculatorStoredState(raw: unknown): CalculatorStoredState | null {
  if (!isRecord(raw)) {
    return null;
  }
  if (raw.v !== CALCULATOR_STORAGE_VERSION) {
    return null;
  }

  const mode: CalculatorStoredMode = raw.mode === "CWA" ? "CWA" : "GPA";
  const gradeScale: CalculatorStoredScale = raw.gradeScale === "4.0" ? "4.0" : "5.0";

  const rowsRaw = raw.rows;
  let rows: CalculatorStoredRow[];
  if (!Array.isArray(rowsRaw) || rowsRaw.length === 0) {
    rows = createDefaultCalculatorRows();
  } else {
    const parsed = rowsRaw.map(parseRow).filter((row): row is CalculatorStoredRow => row !== null);
    rows = parsed.length > 0 ? parsed : createDefaultCalculatorRows();
  }

  const pastCredits = clamp(Number(raw.pastCredits) || 0, 0, 500);
  const pastAverage = clamp(Number(raw.pastAverage) || 0, 0, 1000);
  const legacyTarget = Number(raw.targetSemesterGpa ?? raw.targetFinal) || 0;

  const scaleMax = gradeScale === "5.0" ? 5 : 4;
  const pastAverageClamped =
    mode === "GPA" ? clamp(pastAverage, 0, scaleMax) : clamp(pastAverage, 0, 100);
  const targetSemesterGpaClamped =
    mode === "GPA" ? clamp(legacyTarget, 0, scaleMax) : clamp(legacyTarget, 0, 100);

  return {
    v: CALCULATOR_STORAGE_VERSION,
    mode,
    gradeScale,
    rows,
    pastCredits,
    pastAverage: pastAverageClamped,
    targetSemesterGpa: targetSemesterGpaClamped,
  };
}

export function loadCalculatorState(uid: string, semesterId: string): CalculatorStoredState | null {
  if (typeof window === "undefined") {
    return null;
  }
  const key = calculatorLocalStorageKey(uid, semesterId);
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return parseCalculatorStoredState(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function saveCalculatorState(uid: string, semesterId: string, state: Omit<CalculatorStoredState, "v">) {
  if (typeof window === "undefined") {
    return;
  }
  const key = calculatorLocalStorageKey(uid, semesterId);
  const payload: CalculatorStoredState = { v: CALCULATOR_STORAGE_VERSION, ...state };
  window.localStorage.setItem(key, JSON.stringify(payload));
}
