/** Legacy global key (single timetable for all semesters). Superseded by scoped keys. */
export const TIMETABLE_LEGACY_STORAGE_KEY = "tsa.timetable.v1";

/** Per-user, per-semester timetable in localStorage. */
export function timetableStorageKeyForUserSemester(uid: string, semesterId: string) {
  return `tsa.timetable.v2:${uid}:${semesterId}`;
}

export const TIMETABLE_STORAGE_VERSION = 1 as const;
export const DEFAULT_TIMETABLE_START_HOUR = 7;
export const DEFAULT_TIMETABLE_END_HOUR = 19;

export type TimetableEntry = {
  courseId: string;
  courseName: string;
  lecturerName: string;
  location: string;
  durationHours: number;
};

export type TimetableState = Record<string, TimetableEntry>;

export type TimetableStorage = {
  v: typeof TIMETABLE_STORAGE_VERSION;
  startHour: number;
  endHour: number;
  entries: TimetableState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function coerceEntry(entryValue: unknown): TimetableEntry | null {
  if (typeof entryValue === "string") {
    return {
      courseId: "",
      courseName: entryValue,
      lecturerName: "",
      location: "",
      durationHours: 1,
    };
  }
  if (!isRecord(entryValue)) {
    return null;
  }
  return {
    courseId: typeof entryValue.courseId === "string" ? entryValue.courseId : "",
    courseName: typeof entryValue.courseName === "string" ? entryValue.courseName : "",
    lecturerName: typeof entryValue.lecturerName === "string" ? entryValue.lecturerName : "",
    location: typeof entryValue.location === "string" ? entryValue.location : "",
    durationHours: Math.max(1, Math.floor(Number(entryValue.durationHours) || 1)),
  };
}

function coerceEntries(rawEntries: unknown): TimetableState {
  if (!isRecord(rawEntries)) {
    return {};
  }
  const migratedEntries: TimetableState = {};
  for (const [entryKey, entryValue] of Object.entries(rawEntries)) {
    const entry = coerceEntry(entryValue);
    if (entry) {
      migratedEntries[entryKey] = entry;
    }
  }
  return migratedEntries;
}

export function parseTimetableStorage(raw: string): TimetableStorage | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const startHour =
      typeof parsed.startHour === "number" ? parsed.startHour : DEFAULT_TIMETABLE_START_HOUR;
    const endHour = typeof parsed.endHour === "number" ? parsed.endHour : DEFAULT_TIMETABLE_END_HOUR;
    return {
      v: TIMETABLE_STORAGE_VERSION,
      startHour,
      endHour,
      entries: coerceEntries(parsed.entries),
    };
  } catch {
    return null;
  }
}

export function parseTimetableFromRemotePayload(raw: unknown): TimetableStorage | null {
  if (!isRecord(raw)) {
    return null;
  }
  const payload: Record<string, unknown> = { ...raw };
  delete payload.createdAt;
  delete payload.updatedAt;
  return parseTimetableStorage(JSON.stringify(payload));
}

export function serializeTimetableStorage(input: {
  startHour: number;
  endHour: number;
  entries: TimetableState;
}) {
  return JSON.stringify({
    v: TIMETABLE_STORAGE_VERSION,
    startHour: input.startHour,
    endHour: input.endHour,
    entries: input.entries,
  });
}
