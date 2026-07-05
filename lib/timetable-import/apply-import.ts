import type { Course } from "../types/domain";
import type { TimetableEntry, TimetableState } from "../timetable-storage";
import {
  hourToSlotKey,
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

function findCourseByTitle(courses: Course[], title: string) {
  const key = titleKey(title);
  return courses.find((course) => titleKey(course.title) === key) ?? null;
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

export function buildTimetableImportPlan(
  payload: TimetableImportPayload,
  existingCourses: Course[],
  defaultStartHour: number,
  defaultEndHour: number,
): ApplyTimetableImportResult {
  const courseMatches: Record<string, string> = {};
  const coursesToCreate: TimetableImportCourse[] = [];
  const seenNew = new Set<string>();

  for (const course of payload.courses) {
    const existing = findCourseByTitle(existingCourses, course.title);
    if (existing) {
      courseMatches[titleKey(course.title)] = existing.id;
      continue;
    }
    const key = titleKey(course.title);
    if (!seenNew.has(key)) {
      seenNew.add(key);
      coursesToCreate.push(course);
    }
  }

  for (const slot of payload.slots) {
    const existing = findCourseByTitle(existingCourses, slot.courseTitle);
    if (existing) {
      courseMatches[titleKey(slot.courseTitle)] = existing.id;
      continue;
    }
    const key = titleKey(slot.courseTitle);
    if (seenNew.has(key)) {
      continue;
    }
    seenNew.add(key);
    coursesToCreate.push({
      title: slot.courseTitle,
      lecturerName: slot.lecturerName,
    });
  }

  const startHour = payload.startHour ?? defaultStartHour;
  const endHour = payload.endHour ?? requiredEndHour(payload.slots, defaultEndHour);
  const entries: TimetableState = {};

  for (const slot of payload.slots) {
    const matchKey = titleKey(slot.courseTitle);
    const entry: TimetableEntry = {
      courseId: courseMatches[matchKey] ?? "",
      courseName: slot.courseTitle,
      lecturerName: slot.lecturerName ?? "",
      location: slot.location ?? "",
      durationHours: slot.durationHours,
    };
    entries[slotEntryKey(slot)] = entry;
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
