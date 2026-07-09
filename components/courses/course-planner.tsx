"use client";

import { useCallback, useEffect, useState } from "react";
import { NotebookPen, Pencil, Trash2 } from "lucide-react";
import { formatNoteTimestamp, noteCardTitle } from "@/lib/course-notes";
import { getCoursePlan, saveCoursePlan } from "@/lib/data/course-plan";
import type { CourseNote } from "@/lib/types/domain";
import {
  FORM_INPUT_CLASS_BLOCK,
  FORM_PRIMARY_BUTTON_CLASS,
  FORM_SECONDARY_BUTTON_CLASS,
} from "@/lib/ui/form-styles";
import { ShimmerPanel } from "@/components/ui/shimmer";
import { useToast } from "@/providers/toast-provider";

type CoursePlannerProps = {
  uid: string;
  semesterId: string;
  courseId: string;
};

export function CoursePlanner({ uid, semesterId, courseId }: CoursePlannerProps) {
  const { pushToast } = useToast();
  const [savedNotes, setSavedNotes] = useState<CourseNote[]>([]);
  const [draftNoteTitle, setDraftNoteTitle] = useState("");
  const [draftNoteBody, setDraftNoteBody] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const persist = useCallback(
    async (nextNotes: CourseNote[]) => {
      setIsSaving(true);
      try {
        await saveCoursePlan(uid, semesterId, courseId, { notes: nextNotes });
      } catch {
        pushToast("Could not save your notes.", "error");
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
    await persist(nextNotes);
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
    await persist(nextNotes);
    pushToast("Note removed.", "info");
  }

  if (isLoading) {
    return <ShimmerPanel barClassName="from-amber-500 to-violet-500" bodyClassName="h-40" />;
  }

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
              <p className="text-sm font-semibold text-app-fg">Course notes</p>
              <p className="text-xs text-app-subtle">Save lecture summaries and reminders as cards.</p>
            </div>
          </div>
          {isSaving ? <span className="text-xs text-app-subtle">Saving…</span> : null}
        </div>

        <form
          onSubmit={(event) => void handleSaveNote(event)}
          className="space-y-2 rounded-xl border border-app-border bg-app-accent-soft/20 p-3"
        >
          <p className="text-xs font-medium text-app-fg">{editingNoteId ? "Edit note" : "New note"}</p>
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
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-app-subtle">{note.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
