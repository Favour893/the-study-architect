import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/db";
import { semesterCoursesPath } from "@/lib/data/paths";
import type { Course } from "@/lib/types/domain";

export async function listCourses(uid: string, semesterId: string) {
  const db = getDb();
  const ref = collection(db, semesterCoursesPath(uid, semesterId));
  const q = query(ref, orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as Course[];
}

export async function createCourse(
  uid: string,
  semesterId: string,
  payload: { title: string; code?: string; lecturerName?: string },
) {
  const db = getDb();
  const ref = collection(db, semesterCoursesPath(uid, semesterId));
  const courseRef = await addDoc(ref, {
    title: payload.title.trim(),
    code: payload.code?.trim() || "",
    lecturerName: payload.lecturerName?.trim() || "",
    topicCount: 0,
    latestTopicStatus: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return courseRef.id;
}

export async function updateCourse(
  uid: string,
  semesterId: string,
  courseId: string,
  payload: { title: string; code?: string; lecturerName?: string },
) {
  const db = getDb();
  await updateDoc(doc(db, `${semesterCoursesPath(uid, semesterId)}/${courseId}`), {
    title: payload.title.trim(),
    code: payload.code?.trim() || "",
    lecturerName: payload.lecturerName?.trim() || "",
    updatedAt: serverTimestamp(),
  });
}
