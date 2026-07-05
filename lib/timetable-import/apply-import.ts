import type { Course } from "../types/domain";
import type { TimetableEntry, TimetableState } from "../timetable-storage";
import {
  hourToSlotKey,
  normalizeCourseCode,
  type TimetableImportCourse,
  type TimetableImportPayload,
  type TimetableImportSlot,
} from "./parse-import";

export type ApplyTimetableImportResult = {
  coursesToCreate: TimetableImportCourse[];
  entries: TimetableState;
  startHour: number;
  endHour: number;
  courseMatches: Record<string, string>;
};

function titleKey(title: string) {
  return title.trim().toLowerCase();
}

function findExistingCourse(courses: Course[], title: string, code?: string) {
  const titleMatch = titleKey(title);
  const byTitle = courses.find((course) => titleKey(course.title) === titleMatch);
  if (byTitle) {
    return byTitle;
  }
  if (!code?.trim()) {
    return null;
  }
  const codeNorm = normalizeCourseCode(code);
  return (
    courses.find((course) => course.code && normalizeCourseCode(course.code) === codeNorm) ?? null
  );
}

function slotEntryKey(slot: TimetableImportSlot) {
  return `${slot.day}-${hourToSlotKey(slot.startHour)}`;
}

function requiredEndHour(slots: TimetableImportSlot[], fallback: number) {
  let maxEnd = fallback;
  for (const slot of slots) {
    maxEnd = Math.max(maxEnd, slot.startHour + slot.durationHours);
  }
  return Math.min(24, maxEnd);
}

function courseFromCatalog(
  catalog: Map<string, TimetableImportCourse>,
  slot: TimetableImportSlot,
): TimetableImportCourse {
  const fromCatalog = catalog.get(titleKey(slot.courseTitle));
  return {
    title: slot.courseTitle,
    code: slot.courseCode ?? fromCatalog?.code,
    lecturerName: slot.lecturerName ?? fromCatalog?.lecturerName,
    creditUnits: fromCatalog?.creditUnits,
  };
}

export function buildTimetableImportPlan(
  payload: TimetableImportPayload,
  existingCourses: Course[],
  defaultStartHour: number,
  defaultEndHour: number,
): ApplyTimetableImportResult {
  const catalog = new Map<string, TimetableImportCourse>();
  for (const course of payload.courses) {
    catalog.set(titleKey(course.title), course);
  }

  const courseMatches: Record<string, string> = {};
  const coursesToCreate: TimetableImportCourse[] = [];
  const seenNew = new Set<string>();

  function registerExisting(course: TimetableImportCourse, existing: Course) {
    courseMatches[titleKey(course.title)] = existing.id;
    if (course.code) {
      courseMatches[normalizeCourseCode(course.code)] = existing.id;
    }
  }

  function queueCreate(course: TimetableImportCourse) {
    const key = titleKey(course.title);
    if (seenNew.has(key)) {
      return;
    }
    const existing = findExistingCourse(existingCourses, course.title, course.code);
    if (existing) {
      registerExisting(course, existing);
      return;
    }
    seenNew.add(key);
    coursesToCreate.push(course);
  }

  for (const course of payload.courses) {
    const existing = findExistingCourse(existingCourses, course.title, course.code);
    if (existing) {
      registerExisting(course, existing);
      continue;
    }
    queueCreate(course);
  }

  for (const slot of payload.slots) {
    const merged = courseFromCatalog(catalog, slot);
    const existing = findExistingCourse(existingCourses, merged.title, merged.code);
    if (existing) {
      registerExisting(merged, existing);
      continue;
    }
    queueCreate(merged);
  }

  const startHour = payload.startHour ?? defaultStartHour;
  const endHour = payload.endHour ?? requiredEndHour(payload.slots, defaultEndHour);
  const entries: TimetableState = {};

  for (const slot of payload.slots) {
    const merged = courseFromCatalog(catalog, slot);
    const matchKey = titleKey(slot.courseTitle);
    const codeKey = merged.code ? normalizeCourseCode(merged.code) : null;
    const courseId = courseMatches[matchKey] ?? (codeKey ? courseMatches[codeKey] : "") ?? "";

    entries[slotEntryKey(slot)] = {
      courseId,
      courseName: slot.courseTitle,
      lecturerName: slot.lecturerName ?? merged.lecturerName ?? "",
      location: slot.location ?? "",
      durationHours: slot.durationHours,
    };
  }

  return {
    coursesToCreate,
    entries,
    startHour,
    endHour: Math.max(endHour, startHour + 1),
    courseMatches,
  };
}

export function attachCourseIdsToEntries(
  entries: TimetableState,
  titleToId: Record<string, string>,
): TimetableState {
  const next: TimetableState = {};
  for (const [key, entry] of Object.entries(entries)) {
    const id = titleToId[titleKey(entry.courseName)] ?? entry.courseId;
    next[key] = { ...entry, courseId: id };
  }
  return next;
}
