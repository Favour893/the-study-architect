import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { semesterTimetableDocPath } from "@/lib/data/paths";
import { getDb } from "@/lib/firebase/db";
import type { TimetableState } from "@/lib/timetable-storage";
import { parseTimetableFromRemotePayload } from "@/lib/timetable-storage";

type TimetablePayload = {
  startHour: number;
  endHour: number;
  entries: TimetableState;
};

export async function fetchTimetableFromFirestore(uid: string, semesterId: string) {
  const db = getDb();
  const ref = doc(db, semesterTimetableDocPath(uid, semesterId));
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    return null;
  }
  return parseTimetableFromRemotePayload(snapshot.data());
}

export async function saveTimetableToFirestore(
  uid: string,
  semesterId: string,
  payload: TimetablePayload,
) {
  const db = getDb();
  const ref = doc(db, semesterTimetableDocPath(uid, semesterId));
  await setDoc(
    ref,
    {
      startHour: payload.startHour,
      endHour: payload.endHour,
      entries: payload.entries,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}
