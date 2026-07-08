import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "../firebase/db";
import type { CourseNote, CoursePlan } from "../types/domain";

function coursePlanPath(uid: string, semesterId: string, courseId: string) {
  return `users/${uid}/semesters/${semesterId}/courses/${courseId}/plan/main`;
}

function normalizeNote(value: unknown): CourseNote | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  const body = typeof row.body === "string" ? row.body.trim() : "";
  if (!body) {
    return null;
  }
  const now = new Date().toISOString();
  const createdAt = typeof row.createdAt === "string" && row.createdAt ? row.createdAt : now;
  const updatedAt = typeof row.updatedAt === "string" && row.updatedAt ? row.updatedAt : createdAt;
  return {
    id: typeof row.id === "string" ? row.id : crypto.randomUUID(),
    title: typeof row.title === "string" ? row.title.trim() : "",
    body,
    createdAt,
    updatedAt,
  };
}

function normalizeNotesFromFirestore(data: Record<string, unknown>): CourseNote[] {
  if (Array.isArray(data.notes)) {
    return data.notes
      .map(normalizeNote)
      .filter((note): note is CourseNote => note !== null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
  if (typeof data.notes === "string" && data.notes.trim()) {
    const now = new Date().toISOString();
    return [
      {
        id: crypto.randomUUID(),
        title: "",
        body: data.notes.trim(),
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
  return [];
}

export async function getCoursePlan(
  uid: string,
  semesterId: string,
  courseId: string,
): Promise<CoursePlan> {
  const db = getDb();
  const snapshot = await getDoc(doc(db, coursePlanPath(uid, semesterId, courseId)));
  if (!snapshot.exists()) {
    return { notes: [] };
  }
  const data = snapshot.data() as Record<string, unknown>;
  return {
    notes: normalizeNotesFromFirestore(data),
  };
}

export async function saveCoursePlan(
  uid: string,
  semesterId: string,
  courseId: string,
  plan: CoursePlan,
): Promise<void> {
  const db = getDb();
  await setDoc(
    doc(db, coursePlanPath(uid, semesterId, courseId)),
    {
      notes: plan.notes.map((note) => ({
        id: note.id,
        title: note.title.trim(),
        body: note.body.trim(),
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      })),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
