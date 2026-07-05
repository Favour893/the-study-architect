"use client";

import Link from "next/link";
import { useState } from "react";
import { pickCourseAccent } from "@/lib/ui/accents";
import {
  FORM_INPUT_CLASS_BLOCK,
  FORM_PRIMARY_BUTTON_CLASS,
  FORM_SECONDARY_BUTTON_CLASS,
} from "@/lib/ui/form-styles";
import type { Course } from "@/lib/types/domain";

type CourseCardProps = {
  course: Course;
  isEditing: boolean;
  onStartEditing: (courseId: string) => void;
  onCancelEditing: () => void;
  onSaveEdits: (
    courseId: string,
    payload: { title: string; code?: string; lecturerName?: string; creditUnits?: number },
  ) => Promise<void>;
  onDeleteCourse: (courseId: string) => Promise<void>;
};

export function CourseCard({
  course,
  isEditing,
  onStartEditing,
  onCancelEditing,
  onSaveEdits,
  onDeleteCourse,
}: CourseCardProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState(course.title);
  const [code, setCode] = useState(course.code ?? "");
  const [lecturerName, setLecturerName] = useState(course.lecturerName ?? "");
  const [creditUnits, setCreditUnits] = useState(course.creditUnits ?? 3);

  async function handleSave() {
    if (!title.trim()) {
      return;
    }
    setIsSaving(true);
    try {
      await onSaveEdits(course.id, { title, code, lecturerName, creditUnits });
    } finally {
      setIsSaving(false);
    }
    onCancelEditing();
  }

  function handleCancel() {
    setTitle(course.title);
    setCode(course.code ?? "");
    setLecturerName(course.lecturerName ?? "");
    setCreditUnits(course.creditUnits ?? 3);
    onCancelEditing();
  }

  const displayCredits = course.creditUnits ?? 3;
  const accent = pickCourseAccent(course.id);

  return (
    <article className="space-y-4 overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm transition hover:shadow-md">
      <div className={`h-1.5 bg-gradient-to-r ${accent.bar}`} />
      <div className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-app-fg">{course.title}</h3>
          {course.code ? (
            <p className="text-sm font-medium text-app-accent">{course.code}</p>
          ) : null}
          <p className="mt-1 text-sm text-app-fg">
            {displayCredits} {displayCredits === 1 ? "credit" : "credits"}
          </p>
          <div className="mt-1 space-y-0.5">
            {course.lecturerName ? (
              <p className="text-xs text-app-subtle">Lecturer: {course.lecturerName}</p>
            ) : null}
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${accent.badge}`}>
          {course.topicCount} topics
        </span>
      </div>

      {isEditing ? (
        <form
          className="space-y-2 rounded-xl border border-app-border bg-app-muted/40 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={FORM_INPUT_CLASS_BLOCK}
            placeholder="Course title"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={FORM_INPUT_CLASS_BLOCK}
              placeholder="Course code"
            />
            <input
              type="number"
              min={1}
              max={30}
              value={creditUnits}
              onChange={(event) => setCreditUnits(Number(event.target.value) || 3)}
              className={FORM_INPUT_CLASS_BLOCK}
              placeholder="Credit units"
            />
          </div>
          <input
            value={lecturerName}
            onChange={(event) => setLecturerName(event.target.value)}
            className={FORM_INPUT_CLASS_BLOCK}
            placeholder="Lecturer"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => void onDeleteCourse(course.id)}
              className="rounded-md border border-red-300/60 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60"
            >
              Delete
            </button>
            <button type="button" onClick={handleCancel} className={FORM_SECONDARY_BUTTON_CLASS}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className={FORM_PRIMARY_BUTTON_CLASS}>
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      ) : null}

      <p className="mt-4 text-sm text-app-subtle">
        Latest status: <span className="font-medium text-app-fg">{course.latestTopicStatus}</span>
      </p>
      <div className="flex gap-2">
        <Link
          href={`/courses/${course.id}`}
          className="inline-flex rounded-md border border-app-accent/30 bg-app-accent-soft px-3 py-1.5 text-sm font-medium text-app-accent hover:bg-app-accent-light"
        >
          Open syllabus
        </Link>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => onStartEditing(course.id)}
            className="inline-flex rounded-md border border-app-accent/30 bg-app-accent-soft px-3 py-1.5 text-sm font-medium text-app-accent hover:bg-app-accent-light"
          >
            Edit course
          </button>
        ) : null}
      </div>
      </div>
    </article>
  );
}
