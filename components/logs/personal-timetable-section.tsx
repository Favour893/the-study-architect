"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  PERSONAL_TIMETABLE_DAYS,
  PERSONAL_TIMETABLE_END_HOUR,
  PERSONAL_TIMETABLE_START_HOUR,
  personalTimetableStorageKey,
  loadPersonalTimetableEntries,
  serializePersonalTimetableStorage,
  type PersonalTimetableDay,
} from "@/lib/personal-timetable-storage";
import {
  buildBlockSegments,
  clampDurationToWeek,
  findAnchorKeyForCell,
  removeOverlappingEntries,
  slotKeyToIndex,
} from "@/lib/personal-timetable-grid";
import type { TimetableEntry, TimetableState } from "@/lib/timetable-storage";
import { pickCourseAccent } from "@/lib/ui/accents";
import {
  FORM_DANGER_BUTTON_CLASS,
  FORM_INPUT_ACCENT,
  FORM_PRIMARY_BUTTON_CLASS,
  FORM_SECONDARY_BUTTON_CLASS,
} from "@/lib/ui/form-styles";
import { useAuth } from "@/providers/auth-provider";
import { ShimmerPanel } from "@/components/ui/shimmer";

type Slot = {
  key: string;
  label: string;
};

const dayAccent: Record<string, string> = {
  Monday: "text-sky-700 dark:text-sky-300",
  Tuesday: "text-emerald-700 dark:text-emerald-300",
  Wednesday: "text-violet-700 dark:text-violet-300",
  Thursday: "text-amber-700 dark:text-amber-300",
  Friday: "text-rose-700 dark:text-rose-300",
  Saturday: "text-indigo-700 dark:text-indigo-300",
  Sunday: "text-orange-700 dark:text-orange-300",
};

function padHour(hour: number) {
  return String(hour).padStart(2, "0");
}

function hourToKey(hour: number) {
  return `${padHour(hour)}:00`;
}

function hourToLabel(hour: number) {
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "AM" : "PM";
  return `${displayHour}:00 ${suffix}`;
}

function buildSlots(startHour: number, endHour: number) {
  const slots: Slot[] = [];
  for (let hour = startHour; hour < endHour; hour += 1) {
    slots.push({ key: hourToKey(hour), label: hourToLabel(hour) });
  }
  return slots;
}

const slots = buildSlots(PERSONAL_TIMETABLE_START_HOUR, PERSONAL_TIMETABLE_END_HOUR);
const timetableGridWidth = `calc(7rem + ${slots.length} * 4rem)`;
const maxBlockDurationHours = PERSONAL_TIMETABLE_DAYS.length * slots.length;

function readStoredEntries(uid: string): TimetableState {
  return loadPersonalTimetableEntries(uid);
}

export function PersonalTimetableSection() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimetableState>({});
  const [ready, setReady] = useState(false);
  const skipNextSaveRef = useRef(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [draftEntry, setDraftEntry] = useState<TimetableEntry>({
    courseId: "",
    courseName: "",
    lecturerName: "",
    location: "",
    durationHours: 1,
  });

  useEffect(() => {
    if (!user) {
      setEntries({});
      setReady(false);
      skipNextSaveRef.current = true;
      return;
    }
    setEntries(readStoredEntries(user.uid));
    skipNextSaveRef.current = true;
    setReady(true);
  }, [user]);

  useEffect(() => {
    if (!ready || !user) {
      return;
    }
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    window.localStorage.setItem(
      personalTimetableStorageKey(user.uid),
      serializePersonalTimetableStorage(entries),
    );
  }, [entries, ready, user]);

  useEffect(() => {
    if (!editingKey) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeEditor();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingKey]);

  function openEditor(day: string, slotKey: string) {
    const slotIndex = slotKeyToIndex(slotKey);
    const anchorKey =
      slotIndex >= 0
        ? (findAnchorKeyForCell(day as PersonalTimetableDay, slotIndex, entries) ?? `${day}-${slotKey}`)
        : `${day}-${slotKey}`;
    const anchorEntry = entries[anchorKey];
    setEditingKey(anchorKey);
    setDraftEntry({
      courseId: anchorEntry?.courseId ?? "",
      courseName: anchorEntry?.courseName ?? "",
      lecturerName: anchorEntry?.lecturerName ?? "",
      location: anchorEntry?.location ?? "",
      durationHours: anchorEntry?.durationHours ?? 1,
    });
  }

  function closeEditor() {
    setEditingKey(null);
    setDraftEntry({
      courseId: "",
      courseName: "",
      lecturerName: "",
      location: "",
      durationHours: 1,
    });
  }

  function clearEditorEntry() {
    if (!editingKey) {
      return;
    }
    setEntries((current) => {
      if (!(editingKey in current)) {
        return current;
      }
      const next = { ...current };
      delete next[editingKey];
      return next;
    });
    closeEditor();
  }

  function saveEditor() {
    if (!editingKey) {
      return;
    }

    const activityName = draftEntry.courseName.trim();
    if (!activityName) {
      return;
    }

    const safeDuration = clampDurationToWeek(editingKey, draftEntry.durationHours);

    setEntries((current) => {
      const cleaned = removeOverlappingEntries(current, editingKey, safeDuration, editingKey);
      return {
        ...cleaned,
        [editingKey]: {
          courseId: "",
          courseName: activityName,
          lecturerName: "",
          location: draftEntry.location.trim(),
          durationHours: safeDuration,
        },
      };
    });

    closeEditor();
  }

  function moveEntry(fromKey: string, targetDay: string, targetSlotKey: string) {
    const anchorKey = fromKey.trim();
    if (!anchorKey) {
      return;
    }

    setEntries((current) => {
      const draggedEntry = current[anchorKey];
      if (!draggedEntry) {
        return current;
      }

      const nextKey = `${targetDay}-${targetSlotKey}`;
      if (nextKey === anchorKey) {
        return current;
      }

      if (slotKeyToIndex(targetSlotKey) < 0) {
        return current;
      }

      const safeDuration = clampDurationToWeek(nextKey, draggedEntry.durationHours);
      const cleaned = removeOverlappingEntries(current, nextKey, safeDuration, anchorKey);

      return {
        ...cleaned,
        [nextKey]: {
          ...draggedEntry,
          durationHours: safeDuration,
        },
      };
    });
  }

  function renderDayCells(day: string) {
    const daySegments = Object.entries(entries).flatMap(([anchorKey, entry]) =>
      buildBlockSegments(anchorKey, entry.durationHours)
        .filter((segment) => segment.day === day)
        .map((segment) => ({ segment, entry })),
    );

    const byStart = new Map<
      number,
      { segment: (typeof daySegments)[number]["segment"]; entry: TimetableEntry }
    >();
    for (const item of daySegments) {
      byStart.set(item.segment.startIndex, item);
    }

    const coveredIndexes = new Set<number>();
    for (const item of daySegments) {
      for (let offset = 1; offset < item.segment.spanHours; offset += 1) {
        coveredIndexes.add(item.segment.startIndex + offset);
      }
    }

    return slots.map((slot, index) => {
      if (coveredIndexes.has(index)) {
        return null;
      }

      const block = byStart.get(index);
      if (block) {
        const { segment, entry } = block;
        const isActive = editingKey === segment.anchorKey;
        const isDragging = draggingKey === segment.anchorKey;
        const accent = pickCourseAccent(entry.courseName || segment.anchorKey);
        return (
          <td
            key={`${day}-${slot.key}`}
            colSpan={segment.spanHours}
            className="h-[48px] min-w-16 border-b border-app-border px-1 py-1 align-top"
          >
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", segment.anchorKey);
                event.dataTransfer.effectAllowed = "move";
                setDraggingKey(segment.anchorKey);
              }}
              onDragEnd={() => setDraggingKey(null)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const fromKey = event.dataTransfer.getData("text/plain");
                if (!fromKey) {
                  return;
                }
                moveEntry(fromKey, day, slot.key);
                setDraggingKey(null);
              }}
              onClick={() => openEditor(day, slot.key)}
              className={`h-[40px] min-w-0 w-full max-w-full overflow-hidden rounded-md border px-2 py-1.5 text-left shadow-sm transition hover:opacity-95 ${
                isActive ? "ring-2 ring-app-accent/30" : "border-app-border/40"
              } ${isDragging ? "opacity-50" : ""} ${accent.badge}`}
            >
              <div className="flex h-full min-w-0 w-full flex-col justify-center">
                <p className="min-w-0 truncate text-xs font-semibold leading-tight">
                  {entry.courseName || "Block"}
                </p>
                {entry.location ? (
                  <p className="min-w-0 truncate text-[10px] leading-tight opacity-75">{entry.location}</p>
                ) : segment.isContinuation ? (
                  <p className="min-w-0 truncate text-[10px] leading-tight opacity-75">Continued</p>
                ) : null}
              </div>
            </button>
          </td>
        );
      }

      const isActive = editingKey === `${day}-${slot.key}`;
      return (
        <td key={`${day}-${slot.key}`} className="h-[48px] min-w-16 border-b border-app-border px-1 py-1 align-top">
          <button
            type="button"
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const fromKey = event.dataTransfer.getData("text/plain");
              if (!fromKey) {
                return;
              }
              moveEntry(fromKey, day, slot.key);
              event.dataTransfer.clearData();
              setDraggingKey(null);
            }}
            onClick={() => openEditor(day, slot.key)}
            className={`group flex h-[40px] min-w-0 w-full max-w-full items-center justify-center overflow-hidden rounded-md border border-dashed bg-app-accent-soft/20 text-app-subtle transition hover:border-app-accent hover:bg-app-accent-soft ${
              isActive ? "border-app-accent ring-2 ring-app-accent/25" : "border-app-border"
            }`}
            aria-label={`Add block for ${day} at ${slot.label}`}
          >
            <span className="text-sm leading-none opacity-0 transition group-hover:opacity-100 group-hover:text-app-fg group-focus-visible:opacity-100">
              +
            </span>
          </button>
        </td>
      );
    });
  }

  if (!user) {
    return (
      <section className="overflow-hidden rounded-2xl border border-app-border bg-panel p-4 shadow-sm">
        <p className="text-sm text-app-subtle">Sign in to use your personal timetable.</p>
      </section>
    );
  }

  if (!ready) {
    return <ShimmerPanel barClassName="from-teal-500 via-cyan-500 to-sky-500" bodyClassName="h-56" />;
  }

  return (
    <>
      <section
        className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm"
        data-page-guide="logs-timetable"
      >
        <div className="h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500" />
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-200 text-teal-900 dark:bg-teal-900 dark:text-teal-100">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-app-fg">Personal timetable</p>
              <p className="text-xs text-app-subtle">
                Monday to Sunday, all 24 hours — saved on this device. Tap a cell to add a block.
              </p>
            </div>
          </div>

          <p className="text-xs text-app-subtle">
            Swipe horizontally to view all hours. Long blocks continue on the next day automatically.
          </p>

          <div className="overflow-x-auto overscroll-contain">
            <table
              className="table-fixed border-separate border-spacing-0"
              style={{ width: timetableGridWidth, minWidth: timetableGridWidth }}
            >
              <colgroup>
                <col className="w-28" />
                {slots.map((slot) => (
                  <col key={slot.key} className="w-16" />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 w-28 min-w-28 border-b border-r border-app-border bg-app-accent-soft px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-app-accent shadow-[4px_0_8px_-2px_rgba(15,23,42,0.1)]">
                    Day
                  </th>
                  {slots.map((slot) => (
                    <th
                      key={slot.key}
                      className="w-16 min-w-16 max-w-16 border-b border-app-border bg-app-violet-soft/50 px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-app-violet"
                    >
                      <span className="block truncate">{slot.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERSONAL_TIMETABLE_DAYS.map((day) => (
                  <tr key={day}>
                    <td
                      className={`sticky left-0 z-20 w-28 min-w-28 whitespace-nowrap border-b border-r border-app-border bg-panel px-3 py-2 text-sm font-semibold shadow-[4px_0_8px_-2px_rgba(15,23,42,0.1)] ${dayAccent[day] ?? "text-app-fg"}`}
                    >
                      {day}
                    </td>
                    {renderDayCells(day)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {editingKey ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-app-border bg-panel shadow-xl">
            <div className="h-1 bg-gradient-to-r from-teal-500 to-cyan-500" />
            <div className="p-5">
              <h3 className="text-base font-semibold text-app-fg">Update personal block</h3>
              <p className="mt-1 text-sm text-app-subtle">Press Enter to save quickly.</p>
              <form
                className="mt-4 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveEditor();
                }}
              >
                <label className="block space-y-1">
                  <span className="text-sm text-app-subtle">Activity</span>
                  <input
                    value={draftEntry.courseName}
                    onChange={(event) =>
                      setDraftEntry((current) => ({ ...current, courseName: event.target.value }))
                    }
                    placeholder="e.g. Gym, study block, work shift"
                    className={`w-full ${FORM_INPUT_ACCENT}`}
                    autoFocus
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm text-app-subtle">Location</span>
                  <input
                    value={draftEntry.location}
                    onChange={(event) =>
                      setDraftEntry((current) => ({ ...current, location: event.target.value }))
                    }
                    placeholder="Optional location"
                    className={`w-full ${FORM_INPUT_ACCENT}`}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm text-app-subtle">Duration (hours)</span>
                  <input
                    type="number"
                    min={1}
                    max={maxBlockDurationHours}
                    value={draftEntry.durationHours}
                    onFocus={(event) => event.currentTarget.select()}
                    onClick={(event) => event.currentTarget.select()}
                    onChange={(event) =>
                      setDraftEntry((current) => ({
                        ...current,
                        durationHours: Math.max(1, Number(event.target.value) || 1),
                      }))
                    }
                    className={`w-full ${FORM_INPUT_ACCENT}`}
                  />
                  <p className="text-xs text-app-subtle">
                    If this runs past midnight, it continues on the following day.
                  </p>
                </label>
                <div className="flex justify-end gap-2">
                  {entries[editingKey] ? (
                    <button
                      type="button"
                      onClick={clearEditorEntry}
                      className={`mr-auto ${FORM_DANGER_BUTTON_CLASS}`}
                    >
                      Clear cell
                    </button>
                  ) : null}
                  <button type="button" onClick={closeEditor} className={FORM_SECONDARY_BUTTON_CLASS}>
                    Cancel
                  </button>
                  <button type="submit" className={FORM_PRIMARY_BUTTON_CLASS}>
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
