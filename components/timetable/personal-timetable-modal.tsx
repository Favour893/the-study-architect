"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import {
  PERSONAL_TIMETABLE_DAYS,
  PERSONAL_TIMETABLE_END_HOUR,
  PERSONAL_TIMETABLE_START_HOUR,
  parsePersonalTimetableStorage,
  personalTimetableStorageKey,
  serializePersonalTimetableStorage,
} from "@/lib/personal-timetable-storage";
import type { TimetableEntry, TimetableState } from "@/lib/timetable-storage";
import { pickCourseAccent } from "@/lib/ui/accents";
import {
  FORM_DANGER_BUTTON_CLASS,
  FORM_INPUT_ACCENT,
  FORM_PRIMARY_BUTTON_CLASS,
  FORM_SECONDARY_BUTTON_CLASS,
} from "@/lib/ui/form-styles";
import { useAuth } from "@/providers/auth-provider";

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

export function PersonalTimetableButton() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [entries, setEntries] = useState<TimetableState>({});
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
      return;
    }
    const raw = window.localStorage.getItem(personalTimetableStorageKey(user.uid));
    const parsed = raw ? parsePersonalTimetableStorage(raw) : null;
    setEntries(parsed?.entries ?? {});
  }, [user]);

  useEffect(() => {
    if (!isOpen || !user) {
      return;
    }
    setHydrated(true);
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen || !hydrated || !user) {
      return;
    }
    const key = personalTimetableStorageKey(user.uid);
    window.localStorage.setItem(key, serializePersonalTimetableStorage(entries));
  }, [entries, hydrated, isOpen, user]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (editingKey) {
          closeEditor();
        } else {
          setIsOpen(false);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, editingKey]);

  const entryCount = useMemo(() => Object.keys(entries).length, [entries]);

  function openEditor(day: string, slotKey: string) {
    const key = `${day}-${slotKey}`;
    setEditingKey(key);
    setDraftEntry({
      courseId: entries[key]?.courseId ?? "",
      courseName: entries[key]?.courseName ?? "",
      lecturerName: entries[key]?.lecturerName ?? "",
      location: entries[key]?.location ?? "",
      durationHours: entries[key]?.durationHours ?? 1,
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

  function getRange(day: string, slotKey: string, durationHours: number) {
    const start = slots.findIndex((slot) => slot.key === slotKey);
    const clampedStart = Math.max(0, start);
    const end = Math.min(slots.length, clampedStart + durationHours);
    return { day, start: clampedStart, end };
  }

  function overlaps(
    left: { day: string; start: number; end: number },
    right: { day: string; start: number; end: number },
  ) {
    if (left.day !== right.day) {
      return false;
    }
    return left.start < right.end && right.start < left.end;
  }

  function saveEditor() {
    if (!editingKey) {
      return;
    }

    const [day, slotKey] = editingKey.split("-");
    const startIndex = slots.findIndex((slot) => slot.key === slotKey);
    const maxDuration = Math.max(1, slots.length - startIndex);
    const safeDuration = Math.min(Math.max(1, draftEntry.durationHours), maxDuration);
    const activityName = draftEntry.courseName.trim();

    if (!activityName) {
      return;
    }

    const nextRange = getRange(day, slotKey, safeDuration);

    setEntries((current) => {
      const cleaned: TimetableState = {};
      for (const [existingKey, existingValue] of Object.entries(current)) {
        if (existingKey === editingKey) {
          continue;
        }
        const [existingDay, existingSlotKey] = existingKey.split("-");
        const existingRange = getRange(existingDay, existingSlotKey, existingValue.durationHours);
        if (!overlaps(nextRange, existingRange)) {
          cleaned[existingKey] = existingValue;
        }
      }

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
    const sourceKey = fromKey.trim();
    if (!sourceKey) {
      return;
    }

    setEntries((current) => {
      const draggedEntry = current[sourceKey];
      if (!draggedEntry) {
        return current;
      }

      const nextKey = `${targetDay}-${targetSlotKey}`;
      if (nextKey === sourceKey) {
        return current;
      }

      const startIndex = slots.findIndex((slot) => slot.key === targetSlotKey);
      if (startIndex < 0) {
        return current;
      }

      const safeDuration = Math.max(1, draggedEntry.durationHours);
      const nextRange = getRange(targetDay, targetSlotKey, safeDuration);

      const cleaned: TimetableState = {};
      for (const [existingKey, existingValue] of Object.entries(current)) {
        if (existingKey === sourceKey) {
          continue;
        }

        const [existingDay, existingSlotKey] = existingKey.split("-");
        const existingRange = getRange(existingDay, existingSlotKey, existingValue.durationHours);
        if (!overlaps(nextRange, existingRange)) {
          cleaned[existingKey] = existingValue;
        }
      }

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
    const blocks = Object.entries(entries)
      .filter(([entryKey]) => entryKey.startsWith(`${day}-`))
      .map(([entryKey, entry]) => ({
        entryKey,
        entry,
        startIndex: slots.findIndex((slot) => slot.key === entryKey.slice(-5)),
      }))
      .filter((block) => block.startIndex >= 0)
      .sort((a, b) => a.startIndex - b.startIndex);

    const byStart = new Map<number, { entryKey: string; entry: TimetableEntry }>();
    for (const block of blocks) {
      const maxSpan = Math.max(1, slots.length - block.startIndex);
      byStart.set(block.startIndex, {
        entryKey: block.entryKey,
        entry: { ...block.entry, durationHours: Math.min(block.entry.durationHours, maxSpan) },
      });
    }

    const coveredIndexes = new Set<number>();
    for (const [startIndex, block] of byStart.entries()) {
      for (let offset = 1; offset < block.entry.durationHours; offset += 1) {
        coveredIndexes.add(startIndex + offset);
      }
    }

    return slots.map((slot, index) => {
      if (coveredIndexes.has(index)) {
        return null;
      }

      const block = byStart.get(index);
      if (block) {
        const isActive = editingKey === `${day}-${slot.key}`;
        const isDragging = draggingKey === `${day}-${slot.key}`;
        const accent = pickCourseAccent(block.entry.courseName || block.entryKey);
        return (
          <td
            key={`${day}-${slot.key}`}
            colSpan={block.entry.durationHours}
            className="h-[48px] min-w-16 border-b border-app-border px-1 py-1 align-top"
          >
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", `${day}-${slot.key}`);
                event.dataTransfer.effectAllowed = "move";
                setDraggingKey(`${day}-${slot.key}`);
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
                  {block.entry.courseName || "Block"}
                </p>
                {block.entry.location ? (
                  <p className="min-w-0 truncate text-[10px] leading-tight opacity-75">{block.entry.location}</p>
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

  function handleOpen() {
    setHydrated(false);
    setEditingKey(null);
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
    setEditingKey(null);
    setHydrated(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={!user}
        className={`inline-flex items-center gap-1.5 ${FORM_SECONDARY_BUTTON_CLASS}`}
        title={user ? "Plan your full week" : "Sign in to use personal timetable"}
      >
        <CalendarDays className="h-4 w-4 text-app-accent" />
        Personal timetable
        {entryCount > 0 ? (
          <span className="rounded-full bg-app-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-app-accent">
            {entryCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-40 flex flex-col bg-black/40 p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="personal-timetable-title"
          onClick={(event) => {
            if (event.target === event.currentTarget && !editingKey) {
              handleClose();
            }
          }}
        >
          <div className="mx-auto flex min-h-0 w-full max-w-[min(100%,96rem)] flex-1 flex-col overflow-hidden rounded-2xl border border-app-border bg-panel shadow-2xl">
            <div className="h-1 shrink-0 bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500" />
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-app-border px-4 py-3">
              <div>
                <h2 id="personal-timetable-title" className="text-base font-semibold text-app-fg">
                  Personal timetable
                </h2>
                <p className="text-xs text-app-subtle">Monday to Sunday, all 24 hours — saved on this device.</p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-app-border text-app-subtle transition hover:bg-app-muted hover:text-app-fg"
                aria-label="Close personal timetable"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="shrink-0 px-4 py-1.5 text-xs text-app-subtle">
              Swipe horizontally to view all hours. Click a cell to add or edit a block.
            </p>

            <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-2 pb-3 sm:px-4">
              {!hydrated ? (
                <div className="flex h-40 items-center justify-center text-sm text-app-subtle">Loading…</div>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isOpen && editingKey ? (
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
                    max={24}
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
