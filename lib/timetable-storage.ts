/** Legacy global key (single timetable for all semesters). Superseded by scoped keys. */
export const TIMETABLE_LEGACY_STORAGE_KEY = "tsa.timetable.v1";

/** Per-user, per-semester timetable in localStorage. */
export function timetableStorageKeyForUserSemester(uid: string, semesterId: string) {
  return `tsa.timetable.v2:${uid}:${semesterId}`;
}
