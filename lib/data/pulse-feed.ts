import { fetchExamTimetableFromFirestore } from "./exam-timetable";
import { getPersonalLog } from "./personal-log";
import { loadExamTimetableLocal } from "../exam-timetable-storage";
import { hasFirebaseConfig } from "../firebase/client";
import {
  buildExamFeedItems,
  buildPersonalTodoFeedItems,
  mergeAndSortPulseFeed,
  type PulseFeedItem,
} from "../pulse/upcoming-items";

export async function loadPulseFeed(uid: string, semesterId: string): Promise<PulseFeedItem[]> {
  const now = new Date();
  let todoItems: PulseFeedItem[] = [];

  try {
    const personalLog = await getPersonalLog(uid);
    todoItems = buildPersonalTodoFeedItems(personalLog.todos, now);
  } catch {
    todoItems = [];
  }

  let examStorage = hasFirebaseConfig ? await fetchExamTimetableFromFirestore(uid, semesterId) : null;
  if (!examStorage) {
    examStorage = loadExamTimetableLocal(uid, semesterId);
  }

  const examItems = examStorage
    ? buildExamFeedItems(examStorage.columns, examStorage.rows, now)
    : [];

  return mergeAndSortPulseFeed([...todoItems, ...examItems]);
}
