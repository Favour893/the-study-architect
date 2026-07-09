import type { TimetableEntry, TimetableState } from "@/lib/timetable-storage";

export const PERSONAL_TIMETABLE_STORAGE_VERSION = 1 as const;
export const PERSONAL_TIMETABLE_START_HOUR = 0;
export const PERSONAL_TIMETABLE_END_HOUR = 24;

export const PERSONAL_TIMETABLE_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type PersonalTimetableDay = (typeof PERSONAL_TIMETABLE_DAYS)[number];

export type PersonalTimetableStorage = {
  v: typeof PERSONAL_TIMETABLE_STORAGE_VERSION;
  entries: TimetableState;
};

export function personalTimetableStorageKey(uid: string) {
  return `tsa.personal-timetable.v1:${uid}`;
}

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

export function parsePersonalTimetableStorage(raw: string): PersonalTimetableStorage | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      v: PERSONAL_TIMETABLE_STORAGE_VERSION,
      entries: coerceEntries(parsed.entries),
    };
  } catch {
    return null;
  }
}

export function serializePersonalTimetableStorage(entries: TimetableState) {
  return JSON.stringify({
    v: PERSONAL_TIMETABLE_STORAGE_VERSION,
    entries,
  });
}

export function loadPersonalTimetableEntries(uid: string): TimetableState {
  if (typeof window === "undefined") {
    return {};
  }
  const raw = window.localStorage.getItem(personalTimetableStorageKey(uid));
  const parsed = raw ? parsePersonalTimetableStorage(raw) : null;
  return parsed?.entries ?? {};
}
