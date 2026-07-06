import { getCoursePlan } from "./course-plan";
import { fetchExamTimetableFromFirestore } from "./exam-timetable";
import { listCourses } from "./courses";
import { loadExamTimetableLocal } from "../exam-timetable-storage";
import { hasFirebaseConfig } from "../firebase/client";
import {
  buildExamFeedItems,
  buildTodoFeedItems,
  mergeAndSortPulseFeed,
  type PulseFeedItem,
} from "../pulse/upcoming-items";

export async function loadPulseFeed(uid: string, semesterId: string): Promise<PulseFeedItem[]> {
  const courses = await listCourses(uid, semesterId);
  const todoItems: PulseFeedItem[] = [];
  const now = new Date();

  await Promise.all(
    courses.map(async (course) => {
      try {
        const plan = await getCoursePlan(uid, semesterId, course.id);
        todoItems.push(...buildTodoFeedItems(course.id, course.title, plan.todos, now));
      } catch {
        // skip course plan load errors
      }
    }),
  );

  let examStorage = hasFirebaseConfig ? await fetchExamTimetableFromFirestore(uid, semesterId) : null;
  if (!examStorage) {
    examStorage = loadExamTimetableLocal(uid, semesterId);
  }

  const examItems = examStorage
    ? buildExamFeedItems(examStorage.columns, examStorage.rows, now)
    : [];

  return mergeAndSortPulseFeed([...todoItems, ...examItems]);
}
