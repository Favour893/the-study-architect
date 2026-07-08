import type { PersonalTodo } from "../types/domain";
import type { ExamTimetableColumn, ExamTimetableRow } from "../exam-timetable-storage";
import type { ScheduledAlarm } from "./types";
import { ALARM_MAX_FUTURE_MS } from "./types";

function examCellByKey(row: ExamTimetableRow, columns: ExamTimetableColumn[], key: string) {
  const column = columns.find((col) => col.key === key);
  if (!column) {
    return "";
  }
  return row.cells[column.id]?.trim() ?? "";
}

const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type TimetableEntry = {
  courseName?: string;
  location?: string;
  durationHours?: number;
};

type TimetableStorage = {
  entries?: Record<string, TimetableEntry>;
};

function isWithinHorizon(fireAtMs: number, nowMs: number) {
  return fireAtMs > nowMs && fireAtMs - nowMs <= ALARM_MAX_FUTURE_MS;
}

export function buildPersonalTodoAlarms(todos: PersonalTodo[], now = new Date()): ScheduledAlarm[] {
  const nowMs = now.getTime();
  const alarms: ScheduledAlarm[] = [];
  for (const todo of todos) {
    if (!todo.alarmEnabled || todo.done || !todo.dueAt) {
      continue;
    }
    const fireAtMs = new Date(todo.dueAt).getTime();
    if (Number.isNaN(fireAtMs) || !isWithinHorizon(fireAtMs, nowMs)) {
      continue;
    }
    alarms.push({
      id: `personal-todo:${todo.id}`,
      fireAt: new Date(fireAtMs).toISOString(),
      title: "Reminder",
      body: todo.title,
      href: "/logs",
    });
  }
  return alarms;
}

export function buildExamAlarms(
  semesterId: string,
  columns: ExamTimetableColumn[],
  rows: ExamTimetableRow[],
  now = new Date(),
): ScheduledAlarm[] {
  const nowMs = now.getTime();
  const alarms: ScheduledAlarm[] = [];
  for (const row of rows) {
    if (!row.alarmEnabled || !row.alarmAt) {
      continue;
    }
    const fireAtMs = new Date(row.alarmAt).getTime();
    if (Number.isNaN(fireAtMs) || !isWithinHorizon(fireAtMs, nowMs)) {
      continue;
    }
    const courseLabel = examCellByKey(row, columns, "course") || "Exam";
    alarms.push({
      id: `exam:${semesterId}:${row.id}`,
      fireAt: new Date(fireAtMs).toISOString(),
      title: "Exam reminder",
      body: courseLabel,
      href: "/timetable",
    });
  }
  return alarms;
}

function localDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildClassAlarms(timetableRaw: string | null, now = new Date(), daysAhead = 7): ScheduledAlarm[] {
  if (!timetableRaw) {
    return [];
  }

  let parsed: TimetableStorage;
  try {
    parsed = JSON.parse(timetableRaw) as TimetableStorage;
  } catch {
    return [];
  }

  const entries = parsed.entries ?? {};
  const alarms: ScheduledAlarm[] = [];
  const nowMs = now.getTime();

  for (let offset = 0; offset < daysAhead; offset += 1) {
    const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dayName = weekdayNames[dayDate.getDay()];

    for (const [entryKey, entry] of Object.entries(entries)) {
      if (!entryKey.startsWith(`${dayName}-`)) {
        continue;
      }
      const hourPart = entryKey.slice(-5, -3);
      const startHour = Number(hourPart);
      if (Number.isNaN(startHour)) {
        continue;
      }
      const courseName = entry.courseName?.trim();
      if (!courseName) {
        continue;
      }

      const fireAt = new Date(
        dayDate.getFullYear(),
        dayDate.getMonth(),
        dayDate.getDate(),
        startHour,
        0,
        0,
        0,
      );
      const fireAtMs = fireAt.getTime();
      if (!isWithinHorizon(fireAtMs, nowMs)) {
        continue;
      }

      const dateKey = localDateKey(dayDate);
      const location = entry.location?.trim();
      alarms.push({
        id: `class:${entryKey}:${dateKey}`,
        fireAt: fireAt.toISOString(),
        title: "Class starting now",
        body: location ? `${courseName} · ${location}` : courseName,
        href: "/timetable",
      });
    }
  }

  return alarms;
}

export function mergeAlarms(...groups: ScheduledAlarm[][]): ScheduledAlarm[] {
  const byKey = new Map<string, ScheduledAlarm>();
  for (const group of groups) {
    for (const alarm of group) {
      byKey.set(`${alarm.id}:${alarm.fireAt}`, alarm);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => new Date(a.fireAt).getTime() - new Date(b.fireAt).getTime(),
  );
}
