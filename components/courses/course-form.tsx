"use client";

import { useState } from "react";
import {
  FORM_FIELD_SPAN_2_CLASS,
  FORM_INPUT_ACCENT,
  FORM_INPUT_INFO,
  FORM_INPUT_TEAL,
  FORM_INPUT_VIOLET,
  FORM_PRIMARY_BUTTON_CLASS,
  FORM_SHELL_BAR_CLASS,
  FORM_SHELL_BODY_CLASS,
  FORM_SHELL_CLASS,
} from "@/lib/ui/form-styles";
import { ShimmerButton } from "@/components/ui/shimmer";

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
    <form onSubmit={handleSubmit} className={FORM_SHELL_CLASS}>
      <div className={FORM_SHELL_BAR_CLASS} />
      <div className={FORM_SHELL_BODY_CLASS}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Course title"
          className={`${FORM_INPUT_ACCENT} ${FORM_FIELD_SPAN_2_CLASS}`}
        />
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Code (optional)"
          className={FORM_INPUT_VIOLET}
        />
        <input
          type="number"
          min={1}
          max={30}
          value={creditUnits}
          onChange={(event) => setCreditUnits(Number(event.target.value) || 3)}
          placeholder="Credits"
          className={FORM_INPUT_TEAL}
        />
        <input
          value={lecturerName}
          onChange={(event) => setLecturerName(event.target.value)}
          placeholder="Lecturer name"
          className={FORM_INPUT_INFO}
        />
        <ShimmerButton
          type="submit"
          loading={isSubmitting}
          loadingLabel="Adding..."
          className={FORM_PRIMARY_BUTTON_CLASS}
        >
          Create course
        </ShimmerButton>
      </div>
    </form>
  );
}
