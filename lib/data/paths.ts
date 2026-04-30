export function userProfilePath(uid: string) {
  return `users/${uid}/profile/main`;
}

export function userSemestersPath(uid: string) {
  return `users/${uid}/semesters`;
}

export function semesterPath(uid: string, semesterId: string) {
  return `users/${uid}/semesters/${semesterId}`;
}

export function semesterCoursesPath(uid: string, semesterId: string) {
  return `users/${uid}/semesters/${semesterId}/courses`;
}

export function semesterCourseTopicsPath(uid: string, semesterId: string, courseId: string) {
  return `users/${uid}/semesters/${semesterId}/courses/${courseId}/topics`;
}

export function semesterTimetableDocPath(uid: string, semesterId: string) {
  return `users/${uid}/semesters/${semesterId}/timetable/main`;
}

export function userGlobalMetricsPath(uid: string) {
  return `users/${uid}/metrics/global`;
}
