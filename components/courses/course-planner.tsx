"use client";

import { useCallback, useEffect, useState } from "react";
import { AlarmClock, Bell, Check, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { formatNoteTimestamp, noteCardTitle } from "@/lib/course-notes";
import { ensureNotificationPermission } from "@/lib/alarms/notifications";
import { getCoursePlan, saveCoursePlan } from "@/lib/data/course-plan";
import type { CourseNote, CourseTodo } from "@/lib/types/domain";
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

export function CoursePlanner({ uid, semesterId, courseId }: CoursePlannerProps) {
  const { pushToast } = useToast();
  const [savedNotes, setSavedNotes] = useState<CourseNote[]>([]);
  const [todos, setTodos] = useState<CourseTodo[]>([]);
  const [draftNoteTitle, setDraftNoteTitle] = useState("");
  const [draftNoteBody, setDraftNoteBody] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoDue, setNewTodoDue] = useState("");
  const [newTodoAlarm, setNewTodoAlarm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const persist = useCallback(
    async (nextNotes: CourseNote[], nextTodos: CourseTodo[]) => {
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
          setSavedNotes(plan.notes);
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
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  function resetNoteDraft() {
    setDraftNoteTitle("");
    setDraftNoteBody("");
    setEditingNoteId(null);
  }

  async function handleSaveNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draftNoteBody.trim();
    if (!body) {
      pushToast("Write something in your note before saving.", "info");
      return;
    }
    const now = new Date().toISOString();
    let nextNotes: CourseNote[];

    if (editingNoteId) {
      nextNotes = savedNotes.map((note) =>
        note.id === editingNoteId
          ? {
              ...note,
              title: draftNoteTitle.trim(),
              body,
              updatedAt: now,
            }
          : note,
      );
      pushToast("Note updated.", "success");
    } else {
      const newNote: CourseNote = {
        id: crypto.randomUUID(),
        title: draftNoteTitle.trim(),
        body,
        createdAt: now,
        updatedAt: now,
      };
      nextNotes = [newNote, ...savedNotes];
      pushToast("Note saved.", "success");
    }

    setSavedNotes(nextNotes);
    resetNoteDraft();
    await persist(nextNotes, todos);
  }

  function startEditingNote(note: CourseNote) {
    setEditingNoteId(note.id);
    setDraftNoteTitle(note.title);
    setDraftNoteBody(note.body);
  }

  async function removeNote(noteId: string) {
    const nextNotes = savedNotes.filter((note) => note.id !== noteId);
    setSavedNotes(nextNotes);
    if (editingNoteId === noteId) {
      resetNoteDraft();
    }
    await persist(nextNotes, todos);
    pushToast("Note removed.", "info");
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
    await persist(savedNotes, nextTodos);
    pushToast("To-do added.", "success");
  }

  async function toggleTodo(todoId: string) {
    const nextTodos = todos.map((todo) =>
      todo.id === todoId ? { ...todo, done: !todo.done } : todo,
    );
    setTodos(nextTodos);
    await persist(savedNotes, nextTodos);
  }

  async function removeTodo(todoId: string) {
    const nextTodos = todos.filter((todo) => todo.id !== todoId);
    setTodos(nextTodos);
    await persist(savedNotes, nextTodos);
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
    await persist(savedNotes, nextTodos);
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
                Save course notes as cards and track to-dos with optional alarms.
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

        <form
          onSubmit={(event) => void handleSaveNote(event)}
          className="space-y-2 rounded-xl border border-app-border bg-app-accent-soft/20 p-3"
        >
          <p className="text-xs font-medium text-app-fg">
            {editingNoteId ? "Edit note" : "New note"}
          </p>
          <input
            value={draftNoteTitle}
            onChange={(event) => setDraftNoteTitle(event.target.value)}
            placeholder="Title (optional)"
            className={FORM_INPUT_CLASS_BLOCK}
          />
          <textarea
            value={draftNoteBody}
            onChange={(event) => setDraftNoteBody(event.target.value)}
            rows={4}
            placeholder="Lecture summaries, assignment briefs, things to remember…"
            className={`${FORM_INPUT_CLASS_BLOCK} min-h-[6rem] resize-y`}
          />
          <div className="flex flex-wrap justify-end gap-2">
            {editingNoteId ? (
              <button type="button" onClick={resetNoteDraft} className={FORM_SECONDARY_BUTTON_CLASS}>
                Cancel
              </button>
            ) : null}
            <button type="submit" className={FORM_PRIMARY_BUTTON_CLASS}>
              {editingNoteId ? "Update note" : "Save note"}
            </button>
          </div>
        </form>

        {savedNotes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-app-border px-3 py-4 text-center text-xs text-app-subtle">
            No saved notes yet — write above and tap Save note.
          </p>
        ) : (
          <ul className="space-y-2">
            {savedNotes.map((note) => {
              const isEditing = editingNoteId === note.id;
              const wasEdited = note.updatedAt !== note.createdAt;
              return (
                <li
                  key={note.id}
                  className={`rounded-xl border bg-panel px-3 py-3 ${
                    isEditing ? "border-app-accent ring-2 ring-app-accent/20" : "border-app-border"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-app-fg">{noteCardTitle(note)}</p>
                      <p className="mt-0.5 text-[11px] text-app-subtle">
                        {wasEdited ? "Updated" : "Saved"} · {formatNoteTimestamp(note.updatedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEditingNote(note)}
                        className={FORM_SECONDARY_BUTTON_CLASS}
                        aria-label="Edit note"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeNote(note.id)}
                        className={FORM_SECONDARY_BUTTON_CLASS}
                        aria-label="Remove note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-app-subtle">
                    {note.body}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

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
              const isOverdue = Boolean(
                todo.dueAt && !todo.done && new Date(todo.dueAt).getTime() < nowMs,
              );
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
