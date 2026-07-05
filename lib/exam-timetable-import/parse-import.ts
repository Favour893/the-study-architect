import {
  createEmptyExamRow,
  createExamColumn,
  DEFAULT_EXAM_COLUMNS,
  type ExamTimetableColumn,
  type ExamTimetableRow,
} from "../exam-timetable-storage";
import { parseFlexibleDateToIso, parseTimeToInputValue } from "../exam-timetable-dates";

export type ExamImportEntry = {
  day?: string;
  date?: string;
  course?: string;
  venue?: string;
  time?: string;
  extras?: Record<string, string>;
};

export type ExamImportPayload = {
  entries: ExamImportEntry[];
  extraColumnLabels?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeExtras(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    const text = cleanText(raw);
    if (text) {
      out[key.trim()] = text;
    }
  }
  return out;
}

function parseEntry(value: unknown): ExamImportEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  const day = cleanText(value.day);
  const date = cleanText(value.date);
  const course = cleanText(value.course ?? value.courseName ?? value.module);
  const venue = cleanText(value.venue ?? value.location ?? value.room);
  const time = cleanText(value.time ?? value.startTime);
  const extras = normalizeExtras(value.extras);
  if (!day && !date && !course && !venue && !time && Object.keys(extras).length === 0) {
    return null;
  }
  return { day, date, course, venue, time, extras };
}

export function parseExamImportPayload(raw: unknown): ExamImportPayload | null {
  if (!isRecord(raw)) {
    return null;
  }
  const entriesRaw = Array.isArray(raw.entries)
    ? raw.entries
    : Array.isArray(raw.rows)
      ? raw.rows
      : Array.isArray(raw.exams)
        ? raw.exams
        : null;
  if (!entriesRaw) {
    return null;
  }
  const entries = entriesRaw.map(parseEntry).filter((entry): entry is ExamImportEntry => entry !== null);
  if (entries.length === 0) {
    return null;
  }
  const extraColumnLabels = Array.isArray(raw.extraColumnLabels)
    ? raw.extraColumnLabels.map(cleanText).filter(Boolean)
    : undefined;
  return { entries, extraColumnLabels };
}

function columnByKey(columns: ExamTimetableColumn[], key: string) {
  return columns.find((col) => col.key === key);
}

function ensureExtraColumns(
  columns: ExamTimetableColumn[],
  entries: ExamImportEntry[],
  extraLabels?: string[],
): ExamTimetableColumn[] {
  const next = [...columns];
  const labels = new Set<string>();

  if (extraLabels) {
    for (const label of extraLabels) {
      labels.add(label);
    }
  }
  for (const entry of entries) {
    for (const label of Object.keys(entry.extras ?? {})) {
      labels.add(label);
    }
  }

  for (const label of labels) {
    const key = label.toLowerCase().replace(/\s+/g, "_");
    if (key === "time" || next.some((col) => col.key === key || col.label.toLowerCase() === label.toLowerCase())) {
      continue;
    }
    next.push(createExamColumn(label, next));
  }

  return next;
}

export function buildExamRowsFromImport(
  payload: ExamImportPayload,
  existingColumns?: ExamTimetableColumn[],
): { columns: ExamTimetableColumn[]; rows: ExamTimetableRow[] } {
  let columns = existingColumns?.length ? [...existingColumns] : [...DEFAULT_EXAM_COLUMNS];
  columns = ensureExtraColumns(columns, payload.entries, payload.extraColumnLabels);

  const examDateCol = columnByKey(columns, "exam_date");
  const courseCol = columnByKey(columns, "course");
  const venueCol = columnByKey(columns, "venue");
  const timeCol = columnByKey(columns, "time");

  const rows: ExamTimetableRow[] = payload.entries.map((entry) => {
    const row = createEmptyExamRow(columns);
    if (examDateCol) {
      const iso = parseFlexibleDateToIso(entry.date ?? "", entry.day) ?? entry.date ?? entry.day ?? "";
      if (iso) {
        row.cells[examDateCol.id] = iso;
      }
    }
    if (courseCol && entry.course) {
      row.cells[courseCol.id] = entry.course;
    }
    if (venueCol && entry.venue) {
      row.cells[venueCol.id] = entry.venue;
    }
    if (timeCol && entry.time) {
      row.cells[timeCol.id] = parseTimeToInputValue(entry.time) || entry.time;
    }
    for (const [label, value] of Object.entries(entry.extras ?? {})) {
      const col = columns.find((c) => c.label.toLowerCase() === label.toLowerCase());
      if (col) {
        row.cells[col.id] = value;
      }
    }
    return row;
  });

  return { columns, rows };
}
