"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlarmClock,
  Bell,
  Camera,
  ChevronDown,
  ClipboardList,
  ImagePlus,
  Loader2,
  Plus,
  ScanLine,
  Trash2,
} from "lucide-react";
import {
  formatExamDateDisplay,
  formatTimeDisplay,
  toDateInputValue,
} from "@/lib/exam-timetable-dates";
import {
  fetchExamTimetableFromFirestore,
  saveExamTimetableToFirestore,
} from "@/lib/data/exam-timetable";
import { buildExamRowsFromImport, type ExamImportPayload } from "@/lib/exam-timetable-import/parse-import";
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
import { getClientAuth } from "@/lib/firebase/auth";
import { hasFirebaseConfig } from "@/lib/firebase/client";
import type { Course } from "@/lib/types/domain";
import {
  FORM_INPUT_ACCENT,
  FORM_PRIMARY_BUTTON_CLASS,
  FORM_SECONDARY_BUTTON_CLASS,
  FORM_SELECT_CLASS,
} from "@/lib/ui/form-styles";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";

const MAX_BYTES = 5 * 1024 * 1024;
const ALARM_MAX_MS = 30 * 24 * 60 * 60 * 1000;

type ExamTimetableSectionProps = {
  activeSemesterId: string | null;
  semesterLoading: boolean;
  courses: Course[];
};

function courseLabel(course: Pick<Course, "title" | "code">) {
  return course.code?.trim() ? `${course.title} (${course.code})` : course.title;
}

async function readImageAsBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  if (file.size > MAX_BYTES) {
    throw new Error("Photo must be under 5 MB.");
  }
  const mimeType = file.type || "image/jpeg";
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)) {
    throw new Error("Use a JPEG, PNG, or WebP photo.");
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return { base64: btoa(binary), mimeType };
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

async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "granted") {
    return true;
  }
  if (Notification.permission === "denied") {
    return false;
  }
  return (await Notification.requestPermission()) === "granted";
}

function cellByKey(row: ExamTimetableRow, columns: ExamTimetableColumn[], key: string) {
  const col = columns.find((c) => c.key === key);
  return col ? row.cells[col.id] ?? "" : "";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [preview, setPreview] = useState<ExamImportPayload | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handlePointer);
    }
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [menuOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }
    const timers: number[] = [];
    const now = Date.now();
    for (const row of rows) {
      if (!row.alarmEnabled || !row.alarmAt) {
        continue;
      }
      const due = new Date(row.alarmAt).getTime();
      if (Number.isNaN(due) || due <= now || due - now > ALARM_MAX_MS) {
        continue;
      }
      const firedKey = `tsa.exam-alarm:${activeSemesterId}:${row.id}:${row.alarmAt}`;
      if (sessionStorage.getItem(firedKey)) {
        continue;
      }
      const courseLabel = cellByKey(row, columns, "course") || "Exam";
      timers.push(
        window.setTimeout(() => {
          if (Notification.permission !== "granted") {
            return;
          }
          new Notification("Exam reminder", {
            body: courseLabel,
            tag: firedKey,
          });
          sessionStorage.setItem(firedKey, "1");
        }, due - now),
      );
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [rows, columns, activeSemesterId]);

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

  async function handleFile(file: File | undefined) {
    setMenuOpen(false);
    if (!file || !user || !activeSemesterId) {
      if (!user || !activeSemesterId) {
        pushToast("Sign in and select a semester first.", "error");
      }
      return;
    }
    setIsScanning(true);
    try {
      const { base64, mimeType } = await readImageAsBase64(file);
      const firebaseUser = getClientAuth().currentUser;
      if (!firebaseUser) {
        pushToast("Sign in to import an exam timetable photo.", "error");
        return;
      }
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch("/api/import-exam-timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, imageBase64: base64, mimeType }),
      });
      const data = (await res.json()) as ExamImportPayload & { error?: string };
      if (!res.ok) {
        pushToast(data.error ?? "Could not read that photo.", "error");
        return;
      }
      if (!data.entries?.length) {
        pushToast("No exam rows found in that photo.", "info");
        return;
      }
      setPreview(data);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not read that photo.", "error");
    } finally {
      setIsScanning(false);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      if (cameraRef.current) {
        cameraRef.current.value = "";
      }
    }
  }

  function applyPreview() {
    if (!preview) {
      return;
    }
    setIsApplying(true);
    try {
      const built = buildExamRowsFromImport(preview, columns);
      setColumns(built.columns);
      setRows((current) => [...current, ...built.rows]);
      setPreview(null);
      pushToast(`Added ${built.rows.length} exam row(s) from photo.`, "success");
    } catch {
      pushToast("Could not apply the imported exam timetable.", "error");
    } finally {
      setIsApplying(false);
    }
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

  const previewBuilt = preview ? buildExamRowsFromImport(preview, columns) : null;

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

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              disabled={isScanning || !user || !activeSemesterId}
              onClick={() => setMenuOpen((open) => !open)}
              className={`inline-flex items-center gap-1.5 ${FORM_PRIMARY_BUTTON_CLASS}`}
            >
              {isScanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanLine className="h-4 w-4" />
              )}
              Import exam photo
              <ChevronDown className="h-4 w-4 opacity-80" />
            </button>
            {menuOpen ? (
              <div
                className="absolute right-0 top-full z-20 mt-1.5 min-w-[11rem] overflow-hidden rounded-xl border border-app-border bg-panel py-1 shadow-lg"
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-app-fg hover:bg-app-muted"
                  onClick={() => cameraRef.current?.click()}
                >
                  <Camera className="h-4 w-4 text-app-accent" />
                  Take photo
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-app-fg hover:bg-app-muted"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4 text-app-violet" />
                  Upload photo
                </button>
              </div>
            ) : null}
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
                    No exams yet — add a row or import a photo of your exam timetable.
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
            Alarms use browser notifications while this tab is open (within 30 days).
          </p>
        ) : null}
      </div>

      {preview && previewBuilt ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-app-border bg-panel shadow-xl">
            <div className="h-1 bg-gradient-to-r from-rose-500 to-amber-500" />
            <div className="max-h-[85vh] overflow-y-auto p-5">
              <h3 className="text-base font-semibold text-app-fg">Review exam import</h3>
              <p className="mt-1 text-sm text-app-subtle">
                {previewBuilt.rows.length} exam row(s) detected
              </p>
              <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto text-sm">
                {previewBuilt.rows.map((row) => (
                  <li key={row.id} className="rounded-lg border border-app-border px-3 py-2 text-app-fg">
                    <span className="font-medium">{cellByKey(row, previewBuilt.columns, "course") || "Exam"}</span>
                    {cellByKey(row, previewBuilt.columns, "exam_date") ? (
                      <span className="block text-xs text-app-subtle">
                        {formatExamDateDisplay(cellByKey(row, previewBuilt.columns, "exam_date"))}
                      </span>
                    ) : null}
                    {cellByKey(row, previewBuilt.columns, "time") ? (
                      <span className="block text-xs text-app-subtle">
                        {formatTimeDisplay(cellByKey(row, previewBuilt.columns, "time"))}
                      </span>
                    ) : null}
                    {cellByKey(row, previewBuilt.columns, "venue") ? (
                      <span className="block text-xs text-app-subtle">
                        Venue: {cellByKey(row, previewBuilt.columns, "venue")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className={FORM_SECONDARY_BUTTON_CLASS}
                  disabled={isApplying}
                  onClick={() => setPreview(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={FORM_PRIMARY_BUTTON_CLASS}
                  disabled={isApplying}
                  onClick={applyPreview}
                >
                  {isApplying ? "Adding…" : "Add to exam timetable"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
