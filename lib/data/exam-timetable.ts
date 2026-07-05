import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { semesterExamTimetableDocPath } from "@/lib/data/paths";
import {
  parseExamTimetableFromRemote,
  type ExamTimetableStorage,
} from "@/lib/exam-timetable-storage";
import { getDb } from "@/lib/firebase/db";

export async function fetchExamTimetableFromFirestore(
  uid: string,
  semesterId: string,
): Promise<ExamTimetableStorage | null> {
  const db = getDb();
  const ref = doc(db, semesterExamTimetableDocPath(uid, semesterId));
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    return null;
  }
  return parseExamTimetableFromRemote(snapshot.data());
}

export async function saveExamTimetableToFirestore(
  uid: string,
  semesterId: string,
  payload: ExamTimetableStorage,
): Promise<boolean> {
  try {
    const db = getDb();
    const ref = doc(db, semesterExamTimetableDocPath(uid, semesterId));
    await setDoc(
      ref,
      {
        ...payload,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  } catch {
    return false;
  }
}
