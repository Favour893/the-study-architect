"use client";

import { useState } from "react";

type CourseFormProps = {
  onCreate: (payload: {
    title: string;
    code?: string;
    lecturerName?: string;
    creditUnits?: number;
  }) => Promise<void>;
};

export function CourseForm({ onCreate }: CourseFormProps) {
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [lecturerName, setLecturerName] = useState("");
  const [creditUnits, setCreditUnits] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }

    setIsSubmitting(true);
    await onCreate({ title, code, lecturerName, creditUnits });
    setTitle("");
    setCode("");
    setLecturerName("");
    setCreditUnits(3);
    setIsSubmitting(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-2 rounded-2xl border border-app-border bg-panel p-3 md:grid-cols-6"
    >
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Course title"
        className="rounded-lg border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2 md:col-span-2"
      />
      <input
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Code (optional)"
        className="rounded-lg border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
      />
      <input
        type="number"
        min={1}
        max={30}
        value={creditUnits}
        onChange={(event) => setCreditUnits(Number(event.target.value) || 3)}
        placeholder="Credits"
        className="rounded-lg border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
        title="Credit units"
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
