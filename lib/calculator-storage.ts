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

export type CalculatorStoredRow = {
  id: string;
  title: string;
  units: number;
  grade: CalculatorStoredLetter;
};

export type CalculatorStoredState = {
  v: typeof CALCULATOR_STORAGE_VERSION;
  mode: CalculatorStoredMode;
  gradeScale: CalculatorStoredScale;
  rows: CalculatorStoredRow[];
  pastCredits: number;
  pastAverage: number;
  remainingCredits: number;
  targetFinal: number;
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

export function calculatorLocalStorageKey(uid: string, semesterId: string) {
  return `tsa.calculator.v1:${uid}:${semesterId}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseLetter(value: unknown): CalculatorStoredLetter {
  return typeof value === "string" && LETTER_SET.has(value as CalculatorStoredLetter)
    ? (value as CalculatorStoredLetter)
    : "C";
}

function parseRow(value: unknown): CalculatorStoredRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = typeof value.id === "string" && value.id.length > 0 ? value.id : crypto.randomUUID();
  const title = typeof value.title === "string" ? value.title : "";
  const units = clamp(Number(value.units) || 0, 0, 10);
  return { id, title, units, grade: parseLetter(value.grade) };
}

export function createDefaultCalculatorRows(): CalculatorStoredRow[] {
  return [
    { id: crypto.randomUUID(), title: "", units: 3, grade: "C" },
    { id: crypto.randomUUID(), title: "", units: 2, grade: "C" },
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

  const pastCredits = clamp(Number(raw.pastCredits) || 0, 0, 300);
  const pastAverage = clamp(Number(raw.pastAverage) || 0, 0, 1000);
  const remainingCredits = clamp(Number(raw.remainingCredits) || 1, 1, 300);
  const targetFinal = clamp(Number(raw.targetFinal) || 0, 0, 1000);

  const scaleMax = gradeScale === "5.0" ? 5 : 4;
  const pastAverageClamped =
    mode === "GPA" ? clamp(pastAverage, 0, scaleMax) : clamp(pastAverage, 0, 100);
  const targetFinalClamped =
    mode === "GPA" ? clamp(targetFinal, 0, scaleMax) : clamp(targetFinal, 0, 100);

  return {
    v: CALCULATOR_STORAGE_VERSION,
    mode,
    gradeScale,
    rows,
    pastCredits,
    pastAverage: pastAverageClamped,
    remainingCredits,
    targetFinal: targetFinalClamped,
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
