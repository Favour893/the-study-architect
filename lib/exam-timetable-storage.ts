export const EXAM_TIMETABLE_STORAGE_VERSION = 1 as const;

export type ExamTimetableColumn = {
  id: string;
  key: string;
  label: string;
};

export type ExamTimetableRow = {
  id: string;
  cells: Record<string, string>;
  alarmEnabled: boolean;
  alarmAt: string | null;
};

export type ExamTimetableStorage = {
  v: typeof EXAM_TIMETABLE_STORAGE_VERSION;
  columns: ExamTimetableColumn[];
  rows: ExamTimetableRow[];
};

export const DEFAULT_EXAM_COLUMNS: ExamTimetableColumn[] = [
  { id: "col-day", key: "day", label: "Day" },
  { id: "col-date", key: "date", label: "Date" },
  { id: "col-course", key: "course", label: "Course" },
  { id: "col-venue", key: "venue", label: "Venue" },
];

export function examTimetableStorageKey(uid: string, semesterId: string) {
  return `tsa.exam-timetable.v1:${uid}:${semesterId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function slugKey(label: string) {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return base || `col_${crypto.randomUUID().slice(0, 8)}`;
}

export function createExamColumn(label: string, existing: ExamTimetableColumn[]): ExamTimetableColumn {
  const trimmed = label.trim() || "Column";
  let key = slugKey(trimmed);
  const used = new Set(existing.map((col) => col.key));
  let suffix = 1;
  while (used.has(key)) {
    key = `${slugKey(trimmed)}_${suffix}`;
    suffix += 1;
  }
  return { id: crypto.randomUUID(), key, label: trimmed };
}

export function createEmptyExamRow(columns: ExamTimetableColumn[]): ExamTimetableRow {
  const cells: Record<string, string> = {};
  for (const col of columns) {
    cells[col.id] = "";
  }
  return { id: crypto.randomUUID(), cells, alarmEnabled: false, alarmAt: null };
}

function parseColumn(value: unknown): ExamTimetableColumn | null {
  if (!isRecord(value)) {
    return null;
  }
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const id = typeof value.id === "string" && value.id.length > 0 ? value.id : crypto.randomUUID();
  const key = typeof value.key === "string" && value.key.length > 0 ? value.key : slugKey(label || id);
  if (!label) {
    return null;
  }
  return { id, key, label };
}

function parseRow(value: unknown, columnIds: Set<string>): ExamTimetableRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = typeof value.id === "string" && value.id.length > 0 ? value.id : crypto.randomUUID();
  const cells: Record<string, string> = {};
  const rawCells = isRecord(value.cells) ? value.cells : {};
  for (const colId of columnIds) {
    const cell = rawCells[colId];
    cells[colId] = typeof cell === "string" ? cell : "";
  }
  const alarmEnabled = value.alarmEnabled === true;
  const alarmAt = typeof value.alarmAt === "string" && value.alarmAt.trim() ? value.alarmAt : null;
  return { id, cells, alarmEnabled, alarmAt };
}

export function parseExamTimetableStorage(raw: unknown): ExamTimetableStorage | null {
  if (!isRecord(raw)) {
    return null;
  }
  if (raw.v !== EXAM_TIMETABLE_STORAGE_VERSION) {
    return null;
  }

  const parsedColumns = Array.isArray(raw.columns)
    ? raw.columns.map(parseColumn).filter((col): col is ExamTimetableColumn => col !== null)
    : [];
  const columns = parsedColumns.length > 0 ? parsedColumns : [...DEFAULT_EXAM_COLUMNS];
  const columnIds = new Set(columns.map((col) => col.id));

  const rows = Array.isArray(raw.rows)
    ? raw.rows.map((row) => parseRow(row, columnIds)).filter((row): row is ExamTimetableRow => row !== null)
    : [];

  return { v: EXAM_TIMETABLE_STORAGE_VERSION, columns, rows };
}

export function parseExamTimetableFromRemote(raw: unknown): ExamTimetableStorage | null {
  if (!isRecord(raw)) {
    return null;
  }
  const payload = { ...raw };
  delete payload.updatedAt;
  delete payload.createdAt;
  return parseExamTimetableStorage(payload);
}

export function serializeExamTimetableStorage(state: ExamTimetableStorage): string {
  return JSON.stringify(state);
}

export function loadExamTimetableLocal(uid: string, semesterId: string): ExamTimetableStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(examTimetableStorageKey(uid, semesterId));
  if (!raw) {
    return null;
  }
  try {
    return parseExamTimetableStorage(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveExamTimetableLocal(uid: string, semesterId: string, state: ExamTimetableStorage) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(examTimetableStorageKey(uid, semesterId), serializeExamTimetableStorage(state));
}

export function defaultExamTimetableStorage(): ExamTimetableStorage {
  return {
    v: EXAM_TIMETABLE_STORAGE_VERSION,
    columns: [...DEFAULT_EXAM_COLUMNS],
    rows: [],
  };
}

export function isDefaultExamColumn(column: ExamTimetableColumn) {
  return DEFAULT_EXAM_COLUMNS.some((def) => def.key === column.key);
}
