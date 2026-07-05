"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlarmClock, Bell, Check, NotebookPen, Plus, Trash2 } from "lucide-react";
import { getCoursePlan, saveCoursePlan } from "@/lib/data/course-plan";
import type { CourseTodo } from "@/lib/types/domain";
import {
  FORM_INPUT_ACCENT,
  FORM_INPUT_CLASS_BLOCK,
  FORM_PRIMARY_BUTTON_CLASS,
  FORM_SECONDARY_BUTTON_CLASS,
} from "@/lib/ui/form-styles";
import { useToast } from "@/providers/toast-provider";

type CoursePlannerProps = {
  uid: string;
  semesterId: string;
  courseId: string;
  courseTitle: string;
};

function toDatetimeLocalValue(iso: string | null) {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value.trim()) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function formatDueLabel(iso: string | null) {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "granted") {
    return true;
  }
  if (Notification.permission === "denied") {
    return false;
  }
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function CoursePlanner({ uid, semesterId, courseId, courseTitle }: CoursePlannerProps) {
  const { pushToast } = useToast();
  const [notes, setNotes] = useState("");
  const [todos, setTodos] = useState<CourseTodo[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoDue, setNewTodoDue] = useState("");
  const [newTodoAlarm, setNewTodoAlarm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (nextNotes: string, nextTodos: CourseTodo[]) => {
      setIsSaving(true);
      try {
        await saveCoursePlan(uid, semesterId, courseId, { notes: nextNotes, todos: nextTodos });
      } catch {
        pushToast("Could not save your plan.", "error");
      } finally {
        setIsSaving(false);
      }
    },
    [uid, semesterId, courseId, pushToast],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const plan = await getCoursePlan(uid, semesterId, courseId);
        if (!cancelled) {
          setNotes(plan.notes);
          setTodos(plan.todos);
        }
      } catch {
        if (!cancelled) {
          pushToast("Could not load course notes.", "error");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [uid, semesterId, courseId, pushToast]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const now = Date.now();
    for (const todo of todos) {
      if (!todo.alarmEnabled || todo.done || !todo.dueAt) {
        continue;
      }
      const due = new Date(todo.dueAt).getTime();
      if (Number.isNaN(due) || due <= now) {
        continue;
      }
      const delay = due - now;
      if (delay > 24 * 60 * 60 * 1000) {
        continue;
      }
      const firedKey = `tsa.alarm-fired:${courseId}:${todo.id}:${todo.dueAt}`;
      if (sessionStorage.getItem(firedKey)) {
        continue;
      }
      timers.push(
        window.setTimeout(() => {
          if (Notification.permission !== "granted") {
            return;
          }
          new Notification(`${courseTitle} reminder`, {
            body: todo.title,
            tag: firedKey,
          });
          sessionStorage.setItem(firedKey, "1");
        }, delay),
      );
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [todos, courseId, courseTitle]);

  function scheduleNotesSave(value: string) {
    setNotes(value);
    if (notesSaveTimer.current) {
      clearTimeout(notesSaveTimer.current);
    }
    notesSaveTimer.current = setTimeout(() => {
      void persist(value, todos);
    }, 700);
  }

  async function handleAddTodo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTodoTitle.trim();
    if (!title) {
      return;
    }
    let alarmEnabled = newTodoAlarm;
    if (alarmEnabled && newTodoDue) {
      const allowed = await ensureNotificationPermission();
      if (!allowed) {
        pushToast("Enable browser notifications to use alarms.", "info");
        alarmEnabled = false;
      }
    }
    const nextTodo: CourseTodo = {
      id: crypto.randomUUID(),
      title,
      done: false,
      dueAt: fromDatetimeLocalValue(newTodoDue),
      alarmEnabled: alarmEnabled && Boolean(newTodoDue),
    };
    const nextTodos = [nextTodo, ...todos];
    setTodos(nextTodos);
    setNewTodoTitle("");
    setNewTodoDue("");
    setNewTodoAlarm(false);
    await persist(notes, nextTodos);
    pushToast("To-do added.", "success");
  }

  async function toggleTodo(todoId: string) {
    const nextTodos = todos.map((todo) =>
      todo.id === todoId ? { ...todo, done: !todo.done } : todo,
    );
    setTodos(nextTodos);
    await persist(notes, nextTodos);
  }

  async function removeTodo(todoId: string) {
    const nextTodos = todos.filter((todo) => todo.id !== todoId);
    setTodos(nextTodos);
    await persist(notes, nextTodos);
    pushToast("To-do removed.", "info");
  }

  async function toggleAlarm(todo: CourseTodo) {
    if (!todo.dueAt) {
      pushToast("Set a due date before enabling an alarm.", "info");
      return;
    }
    if (!todo.alarmEnabled) {
      const allowed = await ensureNotificationPermission();
      if (!allowed) {
        pushToast("Enable browser notifications to use alarms.", "info");
        return;
      }
    }
    const nextTodos = todos.map((row) =>
      row.id === todo.id ? { ...row, alarmEnabled: !row.alarmEnabled } : row,
    );
    setTodos(nextTodos);
    await persist(notes, nextTodos);
  }

  if (isLoading) {
    return (
      <section className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
        <div className="h-1 animate-pulse bg-gradient-to-r from-amber-500 to-violet-500" />
        <div className="h-40 animate-pulse bg-app-accent-soft/30 p-6" />
      </section>
    );
  }

  const openCount = todos.filter((todo) => !todo.done).length;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm"
      data-page-guide="course-planner"
    >
      <div className="h-1 bg-gradient-to-r from-amber-500 via-violet-500 to-sky-500" />
      <div className="space-y-5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
              <NotebookPen className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-app-fg">Notes & plan</p>
              <p className="text-xs text-app-subtle">
                Jot course notes and to-dos here. Optional alarms remind you in this browser tab.
              </p>
            </div>
          </div>
          {isSaving ? (
            <span className="text-xs text-app-subtle">Saving…</span>
          ) : (
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
              {openCount} open to-do{openCount === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-app-subtle">Course notes</span>
          <textarea
            value={notes}
            onChange={(event) => scheduleNotesSave(event.target.value)}
            rows={4}
            placeholder="Lecture summaries, assignment briefs, things to remember…"
            className={`${FORM_INPUT_CLASS_BLOCK} min-h-[6rem] resize-y`}
          />
        </label>

        <form onSubmit={(event) => void handleAddTodo(event)} className="space-y-2 rounded-xl border border-app-border bg-app-accent-soft/20 p-3">
          <p className="text-xs font-medium text-app-fg">Add to-do</p>
          <input
            value={newTodoTitle}
            onChange={(event) => setNewTodoTitle(event.target.value)}
            placeholder="e.g. Finish problem set 3"
            className={FORM_INPUT_CLASS_BLOCK}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={newTodoDue}
              onChange={(event) => setNewTodoDue(event.target.value)}
              className={`min-w-0 flex-1 ${FORM_INPUT_ACCENT}`}
              aria-label="Due date and time"
            />
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-panel px-2.5 py-2 text-xs text-app-fg">
              <input
                type="checkbox"
                checked={newTodoAlarm}
                onChange={(event) => setNewTodoAlarm(event.target.checked)}
                className="rounded border-app-border"
              />
              <Bell className="h-3.5 w-3.5 text-app-accent" />
              Alarm
            </label>
            <button type="submit" className={FORM_PRIMARY_BUTTON_CLASS}>
              <Plus className="mr-1 inline h-4 w-4" />
              Add
            </button>
          </div>
        </form>

        {todos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-app-border px-3 py-4 text-center text-xs text-app-subtle">
            No to-dos yet — add revision tasks, deadlines, or reminders above.
          </p>
        ) : (
          <ul className="space-y-2">
            {todos.map((todo) => {
              const dueLabel = formatDueLabel(todo.dueAt);
              const isOverdue = Boolean(todo.dueAt && !todo.done && new Date(todo.dueAt).getTime() < Date.now());
              return (
                <li
                  key={todo.id}
                  className={`flex flex-wrap items-center gap-2 rounded-xl border border-app-border bg-panel px-3 py-2.5 ${
                    todo.done ? "opacity-70" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void toggleTodo(todo.id)}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                      todo.done
                        ? "border-emerald-400 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                        : "border-app-border bg-app-accent-soft text-app-subtle hover:border-app-accent"
                    }`}
                    aria-label={todo.done ? "Mark to-do incomplete" : "Mark to-do complete"}
                  >
                    {todo.done ? <Check className="h-4 w-4" /> : null}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${todo.done ? "line-through text-app-subtle" : "text-app-fg"}`}>
                      {todo.title}
                    </p>
                    {dueLabel ? (
                      <p className={`text-xs ${isOverdue ? "font-medium text-rose-600 dark:text-rose-400" : "text-app-subtle"}`}>
                        {isOverdue ? "Overdue · " : "Due · "}
                        {dueLabel}
                      </p>
                    ) : null}
                  </div>
                  {todo.dueAt ? (
                    <button
                      type="button"
                      onClick={() => void toggleAlarm(todo)}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        todo.alarmEnabled
                          ? "border-app-accent bg-app-accent-soft text-app-accent"
                          : "border-app-border text-app-subtle hover:bg-app-muted"
                      }`}
                      title={todo.alarmEnabled ? "Alarm on" : "Alarm off"}
                    >
                      <AlarmClock className="inline h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void removeTodo(todo.id)}
                    className={FORM_SECONDARY_BUTTON_CLASS}
                    aria-label="Remove to-do"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
