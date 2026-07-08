import type { ExamTimetableColumn, ExamTimetableRow } from "../exam-timetable-storage";
import { formatExamDateDisplay, formatTimeDisplay, toDateInputValue } from "../exam-timetable-dates";
import type { PersonalTodo } from "../types/domain";

export type PulseFeedItemKind = "todo" | "exam";

export type PulseFeedItem = {
  id: string;
  kind: PulseFeedItemKind;
  title: string;
  subtitle: string;
  when: Date | null;
  whenLabel: string;
  courseName: string;
  venue?: string;
  hasAlarm: boolean;
  done: boolean;
  overdue: boolean;
  href: string;
};

function cellByKey(row: ExamTimetableRow, columns: ExamTimetableColumn[], key: string) {
  const col = columns.find((c) => c.key === key);
  return col ? row.cells[col.id]?.trim() ?? "" : "";
}

export function examRowWhen(isoDate: string, time: string): Date | null {
  const iso = toDateInputValue(isoDate);
  if (!iso) {
    return null;
  }
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  if (/^\d{2}:\d{2}$/.test(time)) {
    const [hour, minute] = time.split(":").map(Number);
    return new Date(year, month - 1, day, hour ?? 0, minute ?? 0);
  }
  return new Date(year, month - 1, day, 9, 0);
}

function formatWhenLabel(when: Date | null, now: Date): string {
  if (!when || Number.isNaN(when.getTime())) {
    return "Date not set";
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  const diffDays = Math.round((day.getTime() - today.getTime()) / 86400000);
  const timePart = when.getHours() !== 0 || when.getMinutes() !== 0
    ? ` · ${when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "";

  if (diffDays === 0) {
    return `Today${timePart}`;
  }
  if (diffDays === 1) {
    return `Tomorrow${timePart}`;
  }
  if (diffDays === -1) {
    return `Yesterday${timePart}`;
  }
  if (diffDays < -1) {
    return `${Math.abs(diffDays)} days overdue`;
  }
  if (diffDays <= 7) {
    return `${when.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}${timePart}`;
  }
  return `${when.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}${timePart}`;
}

function isOverdue(when: Date | null, now: Date, done: boolean): boolean {
  if (done || !when || Number.isNaN(when.getTime())) {
    return false;
  }
  return when.getTime() < now.getTime();
}

export function buildPersonalTodoFeedItems(todos: PersonalTodo[], now: Date): PulseFeedItem[] {
  return todos
    .filter((todo) => !todo.done)
    .map((todo) => {
      const when = todo.dueAt ? new Date(todo.dueAt) : null;
      const validWhen = when && !Number.isNaN(when.getTime()) ? when : null;
      return {
        id: `personal-todo:${todo.id}`,
        kind: "todo" as const,
        title: todo.title,
        subtitle: "Personal log",
        when: validWhen,
        whenLabel: validWhen ? formatWhenLabel(validWhen, now) : "No due date",
        courseName: "Personal log",
        hasAlarm: todo.alarmEnabled && Boolean(todo.dueAt),
        done: todo.done,
        overdue: isOverdue(validWhen, now, todo.done),
        href: "/logs",
      };
    });
}

export function buildExamFeedItems(
  columns: ExamTimetableColumn[],
  rows: ExamTimetableRow[],
  now: Date,
): PulseFeedItem[] {
  return rows
    .map((row) => {
      const course = cellByKey(row, columns, "course") || "Exam";
      const venue = cellByKey(row, columns, "venue");
      const dateRaw = cellByKey(row, columns, "exam_date");
      const timeRaw = cellByKey(row, columns, "time");
      const when = examRowWhen(dateRaw, timeRaw);
      const dateLabel = dateRaw ? formatExamDateDisplay(dateRaw) : "";
      const timeLabel = timeRaw ? formatTimeDisplay(timeRaw) : "";
      const subtitleParts = [dateLabel, timeLabel, venue ? `Venue: ${venue}` : ""].filter(Boolean);

      return {
        id: `exam:${row.id}`,
        kind: "exam" as const,
        title: course,
        subtitle: subtitleParts.join(" · ") || "Exam scheduled",
        when,
        whenLabel: when ? formatWhenLabel(when, now) : dateLabel || "Date not set",
        courseName: course,
        venue: venue || undefined,
        hasAlarm: row.alarmEnabled && Boolean(row.alarmAt),
        done: false,
        overdue: isOverdue(when, now, false),
        href: "/timetable",
      };
    })
    .filter((item) => item.title.length > 0 || item.subtitle.length > 0);
}

export function mergeAndSortPulseFeed(items: PulseFeedItem[]): PulseFeedItem[] {
  return [...items].sort((a, b) => {
    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }
    if (!a.when && !b.when) {
      return a.title.localeCompare(b.title);
    }
    if (!a.when) {
      return 1;
    }
    if (!b.when) {
      return -1;
    }
    return a.when.getTime() - b.when.getTime();
  });
}

export function pickPulseHeadline(items: PulseFeedItem[], now: Date): PulseFeedItem | null {
  const sorted = mergeAndSortPulseFeed(items);
  const overdue = sorted.find((item) => item.overdue);
  if (overdue) {
    return overdue;
  }
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 86400000;
  const today = sorted.find(
    (item) => item.when && item.when.getTime() >= todayStart && item.when.getTime() < todayEnd,
  );
  if (today) {
    return today;
  }
  return sorted.find((item) => item.when && item.when.getTime() >= now.getTime()) ?? sorted[0] ?? null;
}

export function upcomingWithinDays(items: PulseFeedItem[], now: Date, days: number): PulseFeedItem[] {
  const horizon = now.getTime() + days * 86400000;
  return mergeAndSortPulseFeed(items).filter((item) => {
    if (item.overdue) {
      return true;
    }
    if (!item.when) {
      return item.kind === "todo";
    }
    return item.when.getTime() <= horizon;
  });
}
