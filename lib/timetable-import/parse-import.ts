export const TIMETABLE_IMPORT_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

export type TimetableImportDay = (typeof TIMETABLE_IMPORT_DAYS)[number];

export type TimetableImportCourse = {
  title: string;
  code?: string;
  lecturerName?: string;
  creditUnits?: number;
};

export type TimetableImportSlot = {
  day: TimetableImportDay;
  startHour: number;
  durationHours: number;
  courseTitle: string;
  location?: string;
  lecturerName?: string;
};

export type TimetableImportPayload = {
  courses: TimetableImportCourse[];
  slots: TimetableImportSlot[];
  startHour?: number;
  endHour?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeDay(value: unknown): TimetableImportDay | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  const match = TIMETABLE_IMPORT_DAYS.find((day) => day.toLowerCase() === trimmed);
  if (match) {
    return match;
  }
  const abbrev: Record<string, TimetableImportDay> = {
    mon: "Monday",
    tue: "Tuesday",
    tues: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    thur: "Thursday",
    thurs: "Thursday",
    fri: "Friday",
  };
  return abbrev[trimmed.slice(0, 5)] ?? abbrev[trimmed.slice(0, 3)] ?? null;
}

function normalizeCourse(value: unknown): TimetableImportCourse | null {
  if (!isRecord(value)) {
    return null;
  }
  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!title) {
    return null;
  }
  const creditUnits =
    typeof value.creditUnits === "number" && !Number.isNaN(value.creditUnits)
      ? Math.min(30, Math.max(1, Math.round(value.creditUnits)))
      : undefined;
  return {
    title,
    code: typeof value.code === "string" ? value.code.trim() : undefined,
    lecturerName: typeof value.lecturerName === "string" ? value.lecturerName.trim() : undefined,
    creditUnits,
  };
}

function normalizeSlot(value: unknown): TimetableImportSlot | null {
  if (!isRecord(value)) {
    return null;
  }
  const day = normalizeDay(value.day);
  const courseTitle = typeof value.courseTitle === "string" ? value.courseTitle.trim() : "";
  const startHour = Number(value.startHour);
  if (!day || !courseTitle || Number.isNaN(startHour)) {
    return null;
  }
  const hour = Math.min(23, Math.max(0, Math.floor(startHour)));
  const durationHours = Math.min(
    12,
    Math.max(1, Math.floor(Number(value.durationHours) || 1)),
  );
  return {
    day,
    startHour: hour,
    durationHours,
    courseTitle,
    location: typeof value.location === "string" ? value.location.trim() : undefined,
    lecturerName: typeof value.lecturerName === "string" ? value.lecturerName.trim() : undefined,
  };
}

export function parseTimetableImportPayload(raw: unknown): TimetableImportPayload | null {
  if (!isRecord(raw)) {
    return null;
  }

  const courses = Array.isArray(raw.courses)
    ? raw.courses.map(normalizeCourse).filter((course): course is TimetableImportCourse => course !== null)
    : [];

  const slots = Array.isArray(raw.slots)
    ? raw.slots.map(normalizeSlot).filter((slot): slot is TimetableImportSlot => slot !== null)
    : [];

  if (courses.length === 0 && slots.length === 0) {
    return null;
  }

  const startHour =
    typeof raw.startHour === "number" && !Number.isNaN(raw.startHour)
      ? Math.min(23, Math.max(0, Math.floor(raw.startHour)))
      : undefined;
  const endHour =
    typeof raw.endHour === "number" && !Number.isNaN(raw.endHour)
      ? Math.min(24, Math.max(1, Math.floor(raw.endHour)))
      : undefined;

  return { courses, slots, startHour, endHour };
}

export function hourToSlotKey(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}
