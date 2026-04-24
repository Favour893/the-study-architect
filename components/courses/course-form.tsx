"use client";

import { useState } from "react";

type CourseFormProps = {
  onCreate: (payload: {
    title: string;
    code?: string;
    lecturerName?: string;
  }) => Promise<void>;
};

export function CourseForm({ onCreate }: CourseFormProps) {
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [lecturerName, setLecturerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }

    setIsSubmitting(true);
    await onCreate({ title, code, lecturerName });
    setTitle("");
    setCode("");
    setLecturerName("");
    setIsSubmitting(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-2xl border border-app-border bg-panel p-4 md:grid-cols-4"
    >
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Course title"
        className="rounded-lg border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
      />
      <input
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Code (optional)"
        className="rounded-lg border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
      />
      <input
        value={lecturerName}
        onChange={(event) => setLecturerName(event.target.value)}
        placeholder="Lecturer name"
        className="rounded-lg border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-app-fg px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? "Adding..." : "Create course"}
      </button>
    </form>
  );
}
