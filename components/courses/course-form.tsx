"use client";

import { useState } from "react";
import { FORM_INPUT_CLASS, FORM_PRIMARY_BUTTON_CLASS } from "@/lib/ui/form-styles";

type CourseFormProps = {
  onCreate: (payload: {
    title: string;
    code?: string;
    lecturerName?: string;
    creditUnits?: number;
  }) => Promise<void>;
  onValidationError?: (message: string) => void;
};

export function CourseForm({ onCreate, onValidationError }: CourseFormProps) {
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [lecturerName, setLecturerName] = useState("");
  const [creditUnits, setCreditUnits] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      onValidationError?.("Course title is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({ title, code, lecturerName, creditUnits });
      setTitle("");
      setCode("");
      setLecturerName("");
      setCreditUnits(3);
    } finally {
      setIsSubmitting(false);
    }
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
        className={`${FORM_INPUT_CLASS} md:col-span-2`}
      />
      <input
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Code (optional)"
        className={FORM_INPUT_CLASS}
      />
      <input
        type="number"
        min={1}
        max={30}
        value={creditUnits}
        onChange={(event) => setCreditUnits(Number(event.target.value) || 3)}
        placeholder="Credits"
        className={FORM_INPUT_CLASS}
      />
      <input
        value={lecturerName}
        onChange={(event) => setLecturerName(event.target.value)}
        placeholder="Lecturer name"
        className={FORM_INPUT_CLASS}
      />
      <button type="submit" disabled={isSubmitting} className={FORM_PRIMARY_BUTTON_CLASS}>
        {isSubmitting ? "Adding..." : "Create course"}
      </button>
    </form>
  );
}
