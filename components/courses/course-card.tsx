"use client";

import Link from "next/link";
import { useState } from "react";
import type { Course } from "@/lib/types/domain";

type CourseCardProps = {
  course: Course;
  isEditing: boolean;
  onStartEditing: (courseId: string) => void;
  onCancelEditing: () => void;
  onSaveEdits: (
    courseId: string,
    payload: { title: string; code?: string; lecturerName?: string },
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

  async function handleSave() {
    if (!title.trim()) {
      return;
    }
    setIsSaving(true);
    await onSaveEdits(course.id, { title, code, lecturerName });
    setIsSaving(false);
    onCancelEditing();
  }

  function handleCancel() {
    setTitle(course.title);
    setCode(course.code ?? "");
    setLecturerName(course.lecturerName ?? "");
    onCancelEditing();
  }

  return (
    <article className="space-y-4 rounded-2xl border border-app-border bg-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-app-fg">{course.title}</h3>
          {course.code ? <p className="text-sm text-app-subtle">{course.code}</p> : null}
          <div className="mt-1 space-y-0.5">
            {course.lecturerName ? (
              <p className="text-xs text-app-subtle">Lecturer: {course.lecturerName}</p>
            ) : null}
          </div>
        </div>
        <span className="rounded-full bg-app-muted px-2.5 py-1 text-xs text-app-subtle">
          {course.topicCount} topics
        </span>
      </div>

      {isEditing ? (
        <div className="space-y-2 rounded-xl border border-app-border bg-white p-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-md border border-app-border px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
            placeholder="Course title"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="w-full rounded-md border border-app-border px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
              placeholder="Course code"
            />
            <input
              value={lecturerName}
              onChange={(event) => setLecturerName(event.target.value)}
              className="w-full rounded-md border border-app-border px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
              placeholder="Lecturer"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => void onDeleteCourse(course.id)}
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-app-border bg-white px-3 py-1.5 text-sm text-app-fg hover:bg-app-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave()}
              className="rounded-md bg-app-fg px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-sm text-app-subtle">
        Latest status: <span className="font-medium text-app-fg">{course.latestTopicStatus}</span>
      </p>
      <div className="flex gap-2">
        <Link
          href={`/courses/${course.id}`}
          className="inline-flex rounded-md border border-app-border bg-white px-3 py-1.5 text-sm text-app-fg hover:bg-app-muted"
        >
          Open syllabus
        </Link>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => onStartEditing(course.id)}
            className="inline-flex rounded-md border border-app-border bg-white px-3 py-1.5 text-sm text-app-fg hover:bg-app-muted"
          >
            Edit course
          </button>
        ) : null}
      </div>
    </article>
  );
}
