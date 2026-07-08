"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlarmClock,
  Bell,
  ClipboardList,
  Plus,
  Trash2,
} from "lucide-react";
import {
  formatExamDateDisplay,
  toDateInputValue,
} from "@/lib/exam-timetable-dates";
import {
  fetchExamTimetableFromFirestore,
  saveExamTimetableToFirestore,
} from "@/lib/data/exam-timetable";
import {
  createEmptyExamRow,
  createExamColumn,
  defaultExamTimetableStorage,
  isDefaultExamColumn,
  loadExamTimetableLocal,
  saveExamTimetableLocal,
  type ExamTimetableColumn,
  type ExamTimetableRow,
  type ExamTimetableStorage,
} from "@/lib/exam-timetable-storage";
import { ensureNotificationPermission } from "@/lib/alarms/notifications";
import { hasFirebaseConfig } from "@/lib/firebase/client";
import type { Course } from "@/lib/types/domain";
import {
  FORM_INPUT_ACCENT,
  FORM_SECONDARY_BUTTON_CLASS,
  FORM_SELECT_CLASS,
} from "@/lib/ui/form-styles";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";

type ExamTimetableSectionProps = {
  activeSemesterId: string | null;
  semesterLoading: boolean;
  courses: Course[];
};

function courseLabel(course: Pick<Course, "title" | "code">) {
  return course.code?.trim() ? `${course.title} (${course.code})` : course.title;
}

function toDatetimeLocalValue(iso: string | null) {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value.trim()) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export function ExamTimetableSection({
  activeSemesterId,
  semesterLoading,
  courses,
}: ExamTimetableSectionProps) {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [columns, setColumns] = useState<ExamTimetableColumn[]>(defaultExamTimetableStorage().columns);
  const [rows, setRows] = useState<ExamTimetableRow[]>([]);
  const [newColumnLabel, setNewColumnLabel] = useState("");
  const loadToken = useRef(0);

  const persist = useCallback(
    (next: ExamTimetableStorage) => {
      if (!user || !activeSemesterId) {
        return;
      }
      saveExamTimetableLocal(user.uid, activeSemesterId, next);
      void saveExamTimetableToFirestore(user.uid, activeSemesterId, next).then((ok) => {
        if (!ok && hasFirebaseConfig) {
          pushToast("Exam timetable saved locally but could not sync to cloud.", "error", "exam-tt-sync");
        }
      });
    },
    [user, activeSemesterId, pushToast],
  );

  useEffect(() => {
    if (semesterLoading) {
      return;
    }
    const token = ++loadToken.current;
    let cancelled = false;

    async function hydrate() {
      setHydrated(false);
      if (!user || !activeSemesterId) {
        const defaults = defaultExamTimetableStorage();
        setColumns(defaults.columns);
        setRows([]);
        if (!cancelled && token === loadToken.current) {
          setHydrated(true);
        }
        return;
      }

      try {
        const fromCloud = hasFirebaseConfig
          ? await fetchExamTimetableFromFirestore(user.uid, activeSemesterId)
          : null;
        const local = loadExamTimetableLocal(user.uid, activeSemesterId);
        const next = fromCloud ?? local ?? defaultExamTimetableStorage();
        if (fromCloud) {
          saveExamTimetableLocal(user.uid, activeSemesterId, fromCloud);
        } else if (local && hasFirebaseConfig) {
          void saveExamTimetableToFirestore(user.uid, activeSemesterId, local);
        }
        if (!cancelled && token === loadToken.current) {
          setColumns(next.columns);
          setRows(next.rows);
        }
      } catch {
        if (!cancelled && token === loadToken.current) {
          const defaults = defaultExamTimetableStorage();
          setColumns(defaults.columns);
          setRows([]);
        }
      } finally {
        if (!cancelled && token === loadToken.current) {
          setHydrated(true);
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [user, activeSemesterId, semesterLoading]);

  useEffect(() => {
    if (!hydrated || !user || !activeSemesterId) {
      return;
    }
    const timer = window.setTimeout(() => {
      persist({ v: 1, columns, rows });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [hydrated, user, activeSemesterId, columns, rows, persist]);

  function updateRow(rowId: string, patch: Partial<ExamTimetableRow>) {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function updateCell(rowId: string, columnId: string, value: string) {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: value } } : row,
      ),
    );
  }

  function addRow() {
    setRows((current) => [...current, createEmptyExamRow(columns)]);
  }

  function removeRow(rowId: string) {
    setRows((current) => current.filter((row) => row.id !== rowId));
  }

  function addColumn() {
    const label = newColumnLabel.trim();
    if (!label) {
      return;
    }
    const col = createExamColumn(label, columns);
    setColumns((current) => [...current, col]);
    setRows((current) =>
      current.map((row) => ({ ...row, cells: { ...row.cells, [col.id]: "" } })),
    );
    setNewColumnLabel("");
  }

  function removeColumn(columnId: string) {
    const col = columns.find((c) => c.id === columnId);
    if (!col || isDefaultExamColumn(col)) {
      return;
    }
    setColumns((current) => current.filter((c) => c.id !== columnId));
    setRows((current) =>
      current.map((row) => {
        const nextCells = { ...row.cells };
        delete nextCells[columnId];
        return { ...row, cells: nextCells };
      }),
    );
  }

  async function toggleRowAlarm(row: ExamTimetableRow) {
    const nextEnabled = !row.alarmEnabled;
    if (nextEnabled) {
      const ok = await ensureNotificationPermission();
      if (!ok) {
        pushToast("Allow notifications in your browser to use exam alarms.", "info");
        return;
      }
    }
    updateRow(row.id, { alarmEnabled: nextEnabled });
  }

  function renderCellInput(row: ExamTimetableRow, col: ExamTimetableColumn) {
    const value = row.cells[col.id] ?? "";

    if (col.key === "exam_date") {
      const iso = toDateInputValue(value);
      const weekday = iso ? formatExamDateDisplay(iso).split(",")[0]?.trim() : "";
      return (
        <div className="flex min-w-[11rem] items-center gap-2">
          <span
            className={`w-[5rem] shrink-0 text-xs font-semibold leading-tight ${
              weekday ? "text-app-accent" : "text-app-subtle/40"
            }`}
          >
            {weekday || "Day"}
          </span>
          <input
            type="date"
            value={iso}
            title={iso ? formatExamDateDisplay(iso) : undefined}
            onChange={(event) => updateCell(row.id, col.id, event.target.value)}
            className={`min-w-0 flex-1 ${FORM_INPUT_ACCENT} px-2 py-1.5 text-sm`}
            aria-label={weekday ? `Exam date, ${weekday}` : "Exam date"}
          />
        </div>
      );
    }

    if (col.key === "time") {
      return (
        <input
          type="time"
          value={value}
          onChange={(event) => updateCell(row.id, col.id, event.target.value)}
          className={`w-full min-w-[8rem] ${FORM_INPUT_ACCENT} px-2 py-1.5 text-sm`}
          aria-label="Exam time"
        />
      );
    }

    if (col.key === "course") {
      if (courses.length === 0) {
        return (
          <input
            value={value}
            onChange={(event) => updateCell(row.id, col.id, event.target.value)}
            placeholder="Course name"
            className={`w-full min-w-[10rem] ${FORM_INPUT_ACCENT} px-2 py-1.5 text-sm`}
            aria-label="Course"
          />
        );
      }
      const knownTitles = new Set(courses.map((c) => c.title));
      const isUnknown = value.length > 0 && !knownTitles.has(value);
      return (
        <select
          value={value}
          onChange={(event) => updateCell(row.id, col.id, event.target.value)}
          className={`w-full min-w-[10rem] ${FORM_SELECT_CLASS} py-1.5 text-sm`}
          aria-label="Course"
        >
          <option value="">Choose course…</option>
          {courses.map((course) => (
            <option key={course.id} value={course.title}>
              {courseLabel(course)}
            </option>
          ))}
          {isUnknown ? (
            <option value={value}>{value}</option>
          ) : null}
        </select>
      );
    }

    return (
      <input
        value={value}
        onChange={(event) => updateCell(row.id, col.id, event.target.value)}
        placeholder={col.label}
        className={`w-full min-w-[7rem] ${FORM_INPUT_ACCENT} px-2 py-1.5 text-sm`}
      />
    );
  }

  if (!hydrated) {
    return (
      <section className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
        <div className="h-1 animate-pulse bg-gradient-to-r from-rose-500 to-amber-500" />
        <div className="h-32 animate-pulse bg-app-accent-soft/30" />
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm" data-page-guide="exam-timetable">
      <div className="h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-orange-500" />
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-950/50">
              <ClipboardList className="h-5 w-5 text-rose-600 dark:text-rose-300" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-app-fg">Exam timetable</h3>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-app-border">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-app-border bg-app-accent-soft/40">
                {columns.map((col) => (
                  <th key={col.id} className="min-w-[8rem] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-app-subtle">
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {!isDefaultExamColumn(col) ? (
                        <button
                          type="button"
                          onClick={() => removeColumn(col.id)}
                          className="rounded p-0.5 text-app-subtle hover:bg-app-muted hover:text-rose-600"
                          aria-label={`Remove ${col.label} column`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      ) : null}
                    </span>
                  </th>
                ))}
                <th className="min-w-[7rem] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-app-subtle">
                  Alarm
                </th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="px-4 py-8 text-center text-sm text-app-subtle">
                    No exams yet — add a row to get started.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-app-border last:border-b-0">
                    {columns.map((col) => (
                      <td key={col.id} className="px-2 py-1.5 align-top">
                        {renderCellInput(row, col)}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 align-top">
                      <div className="flex min-w-[10rem] flex-col gap-1.5">
                        <label className="inline-flex items-center gap-1.5 text-xs text-app-subtle">
                          <input
                            type="checkbox"
                            checked={row.alarmEnabled}
                            onChange={() => void toggleRowAlarm(row)}
                            className="rounded border-app-border"
                          />
                          <Bell className="h-3.5 w-3.5 text-app-accent" />
                          Remind me
                        </label>
                        {row.alarmEnabled ? (
                          <input
                            type="datetime-local"
                            value={toDatetimeLocalValue(row.alarmAt)}
                            onChange={(event) =>
                              updateRow(row.id, { alarmAt: fromDatetimeLocalValue(event.target.value) })
                            }
                            className={`w-full ${FORM_INPUT_ACCENT} px-2 py-1 text-xs`}
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="rounded-md p-1.5 text-app-subtle hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                        aria-label="Remove exam row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={addRow} className={FORM_SECONDARY_BUTTON_CLASS}>
            <Plus className="mr-1 inline h-4 w-4" />
            Add exam row
          </button>
          <div className="flex flex-1 flex-wrap items-center gap-2 sm:max-w-md">
            <input
              value={newColumnLabel}
              onChange={(event) => setNewColumnLabel(event.target.value)}
              placeholder="New column name (e.g. Seat)"
              className={`min-w-0 flex-1 ${FORM_INPUT_ACCENT} px-3 py-1.5 text-sm`}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addColumn();
                }
              }}
            />
            <button type="button" onClick={addColumn} className={FORM_SECONDARY_BUTTON_CLASS}>
              Add column
            </button>
          </div>
        </div>

        {rows.some((r) => r.alarmEnabled) ? (
          <p className="flex items-center gap-1.5 text-xs text-app-subtle">
            <AlarmClock className="h-3.5 w-3.5 text-app-accent" />
            Alarms ring on your phone as notifications — install the app and allow notifications.
          </p>
        ) : null}
      </div>
    </section>
  );
}
