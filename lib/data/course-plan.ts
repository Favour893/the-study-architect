import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "../firebase/db";
import type { CoursePlan, CourseTodo } from "../types/domain";

function coursePlanPath(uid: string, semesterId: string, courseId: string) {
  return `users/${uid}/semesters/${semesterId}/courses/${courseId}/plan/main`;
}

function normalizeTodo(value: unknown): CourseTodo | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!title) {
    return null;
  }
  return {
    id: typeof row.id === "string" ? row.id : crypto.randomUUID(),
    title,
    done: row.done === true,
    dueAt: typeof row.dueAt === "string" && row.dueAt ? row.dueAt : null,
    alarmEnabled: row.alarmEnabled === true,
  };
}

export async function getCoursePlan(
  uid: string,
  semesterId: string,
  courseId: string,
): Promise<CoursePlan> {
  const db = getDb();
  const snapshot = await getDoc(doc(db, coursePlanPath(uid, semesterId, courseId)));
  if (!snapshot.exists()) {
    return { notes: "", todos: [] };
  }
  const data = snapshot.data() as Record<string, unknown>;
  const todos = Array.isArray(data.todos)
    ? data.todos.map(normalizeTodo).filter((todo): todo is CourseTodo => todo !== null)
    : [];
  return {
    notes: typeof data.notes === "string" ? data.notes : "",
    todos,
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
      notes: plan.notes,
      todos: plan.todos.map((todo) => ({
        id: todo.id,
        title: todo.title.trim(),
        done: todo.done,
        dueAt: todo.dueAt,
        alarmEnabled: todo.alarmEnabled,
      })),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
