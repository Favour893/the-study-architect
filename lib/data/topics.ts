import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { semesterCoursesPath, semesterCourseTopicsPath } from "@/lib/data/paths";
import { getDb } from "@/lib/firebase/db";
import type { Topic } from "@/lib/types/domain";

type TopicPayload = {
  title: string;
};

export type TopicLearningStage = "pending" | "taught" | "mastered";

function normalizeLearningStage(topic: Topic): TopicLearningStage {
  if (
    topic.learningStage === "pending" ||
    topic.learningStage === "taught" ||
    topic.learningStage === "mastered"
  ) {
    return topic.learningStage;
  }
  if (topic.learningStage === "studied") {
    return "taught";
  }
  return topic.taughtInClass ? "taught" : "pending";
}

function stagePriorityScore(stage: TopicLearningStage) {
  if (stage === "taught") {
    return 100;
  }
  if (stage === "mastered") {
    return 20;
  }
  return 10;
}

export async function listTopics(uid: string, semesterId: string, courseId: string) {
  const db = getDb();
  const topicsRef = collection(db, semesterCourseTopicsPath(uid, semesterId, courseId));
  const snapshot = await getDocs(topicsRef);

  const topics = snapshot.docs.map((topicDoc) => ({
    id: topicDoc.id,
    ...topicDoc.data(),
  })) as Topic[];

  const normalized = topics.map((topic) => {
    const learningStage = normalizeLearningStage(topic);
    return {
      ...topic,
      learningStage,
      taughtInClass: learningStage !== "pending",
    };
  });

  return normalized.sort((a, b) => {
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
    learningStage: "pending",
    notes: "",
    priorityScore: 10,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await syncCourseTopicMetrics(uid, semesterId, courseId);
}

export async function setTopicNotes(
  uid: string,
  semesterId: string,
  courseId: string,
  topicId: string,
  notes: string,
) {
  const db = getDb();
  const topicRef = doc(db, `${semesterCourseTopicsPath(uid, semesterId, courseId)}/${topicId}`);
  await updateDoc(topicRef, {
    notes: notes.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function setTopicTaughtState(
  uid: string,
  semesterId: string,
  courseId: string,
  topicId: string,
  taughtInClass: boolean,
) {
  const learningStage: TopicLearningStage = taughtInClass ? "taught" : "pending";
  await setTopicLearningStage(uid, semesterId, courseId, topicId, learningStage);
}

export async function setTopicLearningStage(
  uid: string,
  semesterId: string,
  courseId: string,
  topicId: string,
  learningStage: TopicLearningStage,
) {
  const db = getDb();
  const topicRef = doc(db, `${semesterCourseTopicsPath(uid, semesterId, courseId)}/${topicId}`);
  await updateDoc(topicRef, {
    taughtInClass: learningStage !== "pending",
    learningStage,
    priorityScore: stagePriorityScore(learningStage),
    updatedAt: serverTimestamp(),
  });

  await syncCourseTopicMetrics(uid, semesterId, courseId);
}

async function syncCourseTopicMetrics(uid: string, semesterId: string, courseId: string) {
  const db = getDb();
  const topicsRef = collection(db, semesterCourseTopicsPath(uid, semesterId, courseId));
  const topicsSnapshot = await getDocs(topicsRef);
  const topicCount = topicsSnapshot.size;
  const hasTaughtTopic = topicsSnapshot.docs.some((topicDoc) => {
    const data = topicDoc.data() as Topic;
    const stage =
      data.learningStage === "pending" ||
      data.learningStage === "taught" ||
      data.learningStage === "mastered"
        ? data.learningStage
        : data.learningStage === "studied"
          ? "taught"
        : data.taughtInClass
          ? "taught"
          : "pending";
    return stage !== "pending";
  });

  const courseRef = doc(db, `${semesterCoursesPath(uid, semesterId)}/${courseId}`);
  await updateDoc(courseRef, {
    topicCount,
    latestTopicStatus: hasTaughtTopic ? "taught" : "pending",
    updatedAt: serverTimestamp(),
  });
}
