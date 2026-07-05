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
  courseCode?: string;
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

/** Parse 24h hour from startHour number or startTime string like "09:30" or "9:00 AM". */
export function parseImportStartHour(value: unknown, startTime?: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.min(23, Math.max(0, Math.floor(value)));
  }

  const raw = typeof startTime === "string" ? startTime.trim() : typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return null;
  }

  const twentyFour = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    if (Number.isNaN(hour)) {
      return null;
    }
    return Math.min(23, Math.max(0, hour));
  }

  const ampm = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampm) {
    let hour = Number(ampm[1]);
    const suffix = ampm[3]?.toUpperCase();
    if (suffix === "PM" && hour < 12) {
      hour += 12;
    }
    if (suffix === "AM" && hour === 12) {
      hour = 0;
    }
    return Math.min(23, Math.max(0, hour));
  }

  return null;
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
  const code =
    typeof value.code === "string"
      ? value.code.trim()
      : typeof value.courseCode === "string"
        ? value.courseCode.trim()
        : undefined;
  return {
    title,
    code: code || undefined,
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
  const startHour = parseImportStartHour(value.startHour, value.startTime);
  if (!day || !courseTitle || startHour === null) {
    return null;
  }
  const durationHours = Math.min(
    12,
    Math.max(1, Math.floor(Number(value.durationHours) || 1)),
  );
  const courseCode =
    typeof value.courseCode === "string"
      ? value.courseCode.trim()
      : typeof value.code === "string"
        ? value.code.trim()
        : undefined;
  const location =
    typeof value.location === "string"
      ? value.location.trim()
      : typeof value.venue === "string"
        ? value.venue.trim()
        : undefined;
  const lecturerName =
    typeof value.lecturerName === "string"
      ? value.lecturerName.trim()
      : typeof value.lecturer === "string"
        ? value.lecturer.trim()
        : undefined;

  return {
    day,
    startHour,
    durationHours,
    courseTitle,
    courseCode: courseCode || undefined,
    location: location || undefined,
    lecturerName: lecturerName || undefined,
  };
}

/** Merge slot-level metadata into the courses list for a complete catalog. */
function enrichCoursesFromSlots(
  courses: TimetableImportCourse[],
  slots: TimetableImportSlot[],
): TimetableImportCourse[] {
  const byTitle = new Map<string, TimetableImportCourse>();
  for (const course of courses) {
    byTitle.set(course.title.trim().toLowerCase(), { ...course });
  }
  for (const slot of slots) {
    const key = slot.courseTitle.trim().toLowerCase();
    const existing = byTitle.get(key) ?? { title: slot.courseTitle };
    byTitle.set(key, {
      title: slot.courseTitle,
      code: slot.courseCode ?? existing.code,
      lecturerName: slot.lecturerName ?? existing.lecturerName,
      creditUnits: existing.creditUnits,
    });
  }
  return [...byTitle.values()];
}

export function parseTimetableImportPayload(raw: unknown): TimetableImportPayload | null {
  if (!isRecord(raw)) {
    return null;
  }

  const slots = Array.isArray(raw.slots)
    ? raw.slots.map(normalizeSlot).filter((slot): slot is TimetableImportSlot => slot !== null)
    : [];

  let courses = Array.isArray(raw.courses)
    ? raw.courses.map(normalizeCourse).filter((course): course is TimetableImportCourse => course !== null)
    : [];

  courses = enrichCoursesFromSlots(courses, slots);

  if (courses.length === 0 && slots.length === 0) {
    return null;
  }

  const startHour =
    typeof raw.startHour === "number" && !Number.isNaN(raw.startHour)
      ? Math.min(23, Math.max(0, Math.floor(raw.startHour)))
      : slots.length > 0
        ? Math.min(...slots.map((slot) => slot.startHour))
        : undefined;
  const endHour =
    typeof raw.endHour === "number" && !Number.isNaN(raw.endHour)
      ? Math.min(24, Math.max(1, Math.floor(raw.endHour)))
      : slots.length > 0
        ? Math.min(24, Math.max(...slots.map((slot) => slot.startHour + slot.durationHours)))
        : undefined;

  return { courses, slots, startHour, endHour };
}

export function hourToSlotKey(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function normalizeCourseCode(code: string) {
  return code.trim().toLowerCase().replace(/\s+/g, "");
}
