import type { CourseNote } from "./types/domain";

/** Card heading: explicit title, else first sentence of the note body. */
export function noteCardTitle(note: Pick<CourseNote, "title" | "body">): string {
  const explicit = note.title.trim();
  if (explicit) {
    return explicit;
  }
  return firstSentence(note.body);
}

export function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "Untitled note";
  }
  const line = trimmed.split(/\n/)[0]?.trim() ?? trimmed;
  const match = line.match(/^[^.!?]+[.!?]?/);
  const sentence = (match?.[0] ?? line).trim();
  if (sentence.length <= 100) {
    return sentence;
  }
  return `${sentence.slice(0, 97).trim()}…`;
}

export function formatNoteTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
