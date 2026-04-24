import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { semesterCoursesPath, semesterCourseTopicsPath } from "@/lib/data/paths";
import { getDb } from "@/lib/firebase/db";
import type { Topic } from "@/lib/types/domain";

type TopicPayload = {
  title: string;
};

export async function listTopics(uid: string, semesterId: string, courseId: string) {
  const db = getDb();
  const topicsRef = collection(db, semesterCourseTopicsPath(uid, semesterId, courseId));
  const snapshot = await getDocs(topicsRef);

  const topics = snapshot.docs.map((topicDoc) => ({
    id: topicDoc.id,
    ...topicDoc.data(),
  })) as Topic[];

  return topics.sort((a, b) => {
    if (a.taughtInClass !== b.taughtInClass) {
      return a.taughtInClass ? -1 : 1;
    }
    return (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
  });
}

export async function createTopic(
  uid: string,
  semesterId: string,
  courseId: string,
  payload: TopicPayload,
) {
  const db = getDb();
  const topicsRef = collection(db, semesterCourseTopicsPath(uid, semesterId, courseId));
  await addDoc(topicsRef, {
    title: payload.title.trim(),
    taughtInClass: false,
    priorityScore: 10,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await syncCourseTopicMetrics(uid, semesterId, courseId);
}

export async function setTopicTaughtState(
  uid: string,
  semesterId: string,
  courseId: string,
  topicId: string,
  taughtInClass: boolean,
) {
  const db = getDb();
  const topicRef = doc(db, `${semesterCourseTopicsPath(uid, semesterId, courseId)}/${topicId}`);
  await updateDoc(topicRef, {
    taughtInClass,
    priorityScore: taughtInClass ? 100 : 10,
    updatedAt: serverTimestamp(),
  });

  await syncCourseTopicMetrics(uid, semesterId, courseId);
}

async function syncCourseTopicMetrics(uid: string, semesterId: string, courseId: string) {
  const db = getDb();
  const topicsRef = collection(db, semesterCourseTopicsPath(uid, semesterId, courseId));
  const topicsSnapshot = await getDocs(topicsRef);
  const topicCount = topicsSnapshot.size;
  const hasTaughtTopic = topicsSnapshot.docs.some(
    (topicDoc) => Boolean(topicDoc.data().taughtInClass),
  );

  const courseRef = doc(db, `${semesterCoursesPath(uid, semesterId)}/${courseId}`);
  await updateDoc(courseRef, {
    topicCount,
    latestTopicStatus: hasTaughtTopic ? "taught" : "pending",
    updatedAt: serverTimestamp(),
  });
}
