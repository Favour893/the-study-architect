import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { notifyAlarmsChanged } from "@/lib/alarms/alarm-events";
import { getDb } from "../firebase/db";
import type { PersonalLog, PersonalNote, PersonalTodo } from "../types/domain";

function personalLogPath(uid: string) {
  return `users/${uid}/personalLog/main`;
}

function normalizeTodo(value: unknown): PersonalTodo | null {
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

function normalizeNote(value: unknown): PersonalNote | null {
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

export async function getPersonalLog(uid: string): Promise<PersonalLog> {
  const db = getDb();
  const snapshot = await getDoc(doc(db, personalLogPath(uid)));
  if (!snapshot.exists()) {
    return { notes: [], todos: [] };
  }
  const data = snapshot.data() as Record<string, unknown>;
  const notes = Array.isArray(data.notes)
    ? data.notes
        .map(normalizeNote)
        .filter((note): note is PersonalNote => note !== null)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    : [];
  const todos = Array.isArray(data.todos)
    ? data.todos.map(normalizeTodo).filter((todo): todo is PersonalTodo => todo !== null)
    : [];
  return { notes, todos };
}

export async function savePersonalLog(uid: string, log: PersonalLog): Promise<void> {
  const db = getDb();
  await setDoc(
    doc(db, personalLogPath(uid)),
    {
      notes: log.notes.map((note) => ({
        id: note.id,
        title: note.title.trim(),
        body: note.body.trim(),
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      })),
      todos: log.todos.map((todo) => ({
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
  notifyAlarmsChanged();
}
