"use client";

import { useEffect, useMemo, useState } from "react";
import { createCourse, listCourses } from "@/lib/data/courses";
import type { Course } from "@/lib/types/domain";
import { TIMETABLE_LEGACY_STORAGE_KEY, timetableStorageKeyForUserSemester } from "@/lib/timetable-storage";
import { useAuth } from "@/providers/auth-provider";
import { useSemester } from "@/providers/semester-provider";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const defaultStartHour = 7;
const defaultEndHour = 19;
const NEW_COURSE_VALUE = "__new_course__";

type TimetableEntry = {
  courseId: string;
  courseName: string;
  lecturerName: string;
  location: string;
  durationHours: number;
};

type TimetableState = Record<string, TimetableEntry>;

type TimetableStorage = {
  startHour: number;
  endHour: number;
  entries: TimetableState;
};

type Slot = {
  key: string;
  label: string;
};

type MobileBlock = {
  day: string;
  slotKey: string;
  label: string;
  entry: TimetableEntry;
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

function isValidWindow(startHour: number, endHour: number) {
  return startHour >= 0 && endHour <= 24 && endHour > startHour;
}

function isValidTimeSlot(value: string) {
  return /^([01]?\d|2[0-3]):([0-5]\d)$/.test(value);
}

function parseHour(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes !== 0) {
    return null;
  }
  return hours;
}

function requiredEndHourForEntries(entries: TimetableState) {
  let maxRequired = defaultEndHour;
  for (const [entryKey, entry] of Object.entries(entries)) {
    const startSlot = entryKey.slice(-5);
    const startHour = parseHour(startSlot);
    if (startHour === null) {
      continue;
    }
    const duration = Math.max(1, entry.durationHours);
    maxRequired = Math.max(maxRequired, startHour + duration);
  }
  return Math.min(24, maxRequired);
}

function migrateRawEntries(rawEntries: Record<string, unknown>): TimetableState {
  const migratedEntries: TimetableState = {};
  for (const [entryKey, entryValue] of Object.entries(rawEntries)) {
    if (typeof entryValue === "string") {
      migratedEntries[entryKey] = {
        courseId: "",
        courseName: entryValue,
        lecturerName: "",
        location: "",
        durationHours: 1,
      };
      continue;
    }
    if (entryValue && typeof entryValue === "object") {
      const v = entryValue as Record<string, unknown>;
      migratedEntries[entryKey] = {
        courseId: typeof v.courseId === "string" ? v.courseId : "",
        courseName: typeof v.courseName === "string" ? v.courseName : "",
        lecturerName: typeof v.lecturerName === "string" ? v.lecturerName : "",
        location: typeof v.location === "string" ? v.location : "",
        durationHours: Math.max(1, Math.floor(Number(v.durationHours) || 1)),
      };
    }
  }
  return migratedEntries;
}

function parseTimetableStorage(raw: string): Pick<TimetableStorage, "startHour" | "endHour" | "entries"> | null {
  try {
    const parsed = JSON.parse(raw) as TimetableStorage;
    const rawEntries = (parsed.entries ?? {}) as Record<string, unknown>;
    return {
      startHour: typeof parsed.startHour === "number" ? parsed.startHour : defaultStartHour,
      endHour: typeof parsed.endHour === "number" ? parsed.endHour : defaultEndHour,
      entries: migrateRawEntries(rawEntries),
    };
  } catch {
    return null;
  }
}

export default function TimetablePage() {
  const { user } = useAuth();
  const { activeSemesterId, isLoading: semesterLoading } = useSemester();
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [timetableStorageReady, setTimetableStorageReady] = useState(false);
  const [startHour, setStartHour] = useState<number>(defaultStartHour);
  const [endHour, setEndHour] = useState<number>(defaultEndHour);
  const [entries, setEntries] = useState<TimetableState>({});

  const [timeError, setTimeError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [draftEntry, setDraftEntry] = useState<TimetableEntry>({
    courseId: "",
    courseName: "",
    lecturerName: "",
    location: "",
    durationHours: 1,
  });

  const slots = useMemo(() => buildSlots(startHour, endHour), [startHour, endHour]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled || semesterLoading) {
        return;
      }

      if (!user || !activeSemesterId) {
        setStartHour(defaultStartHour);
        setEndHour(defaultEndHour);
        setEntries({});
        setTimetableStorageReady(true);
        return;
      }

      const scopedKey = timetableStorageKeyForUserSemester(user.uid, activeSemesterId);
      let raw = window.localStorage.getItem(scopedKey);
      if (!raw) {
        raw = window.localStorage.getItem(TIMETABLE_LEGACY_STORAGE_KEY);
        if (raw) {
          window.localStorage.setItem(scopedKey, raw);
        }
      }

      const parsed = raw ? parseTimetableStorage(raw) : null;
      if (parsed) {
        setStartHour(parsed.startHour);
        setEndHour(parsed.endHour);
        setEntries(parsed.entries);
      } else {
        setStartHour(defaultStartHour);
        setEndHour(defaultEndHour);
        setEntries({});
      }
      setTimetableStorageReady(true);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user, activeSemesterId, semesterLoading]);

  useEffect(() => {
    if (!timetableStorageReady || semesterLoading || !user || !activeSemesterId) {
      return;
    }
    if (!isValidWindow(startHour, endHour)) {
      return;
    }
    const key = timetableStorageKeyForUserSemester(user.uid, activeSemesterId);
    window.localStorage.setItem(key, JSON.stringify({ startHour, endHour, entries }));
  }, [timetableStorageReady, semesterLoading, user, activeSemesterId, startHour, endHour, entries]);

  useEffect(() => {
    let isMounted = true;

    async function loadSemesterCourses() {
      if (!user || semesterLoading) {
        return;
      }

      try {
        if (!activeSemesterId) {
          if (isMounted) {
            setCourses([]);
            setCoursesError(null);
          }
          return;
        }

        const nextCourses = await listCourses(user.uid, activeSemesterId);
        if (!isMounted) {
          return;
        }
        setCourses(nextCourses);
        setCoursesError(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setCoursesError(error instanceof Error ? error.message : "Could not load courses.");
      }
    }

    void loadSemesterCourses();

    return () => {
      isMounted = false;
    };
  }, [user, activeSemesterId, semesterLoading]);

  const totalFilled = useMemo(
    () =>
      Object.values(entries).filter(
        (value) =>
          value.courseName.trim().length > 0 ||
          value.lecturerName.trim().length > 0 ||
          value.location.trim().length > 0,
      ).length,
    [entries],
  );

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

  async function saveEditor() {
    if (!editingKey) {
      return;
    }

    const [day, slotKey] = editingKey.split("-");
    const startIndex = slots.findIndex((slot) => slot.key === slotKey);
    const maxDuration = Math.max(1, slots.length - startIndex);
    const safeDuration = Math.min(Math.max(1, draftEntry.durationHours), maxDuration);
    const nextRange = getRange(day, slotKey, safeDuration);
    let selectedCourse = courses.find((course) => course.id === draftEntry.courseId);

    if (!selectedCourse && draftEntry.courseId === NEW_COURSE_VALUE) {
      if (!user || !activeSemesterId) {
        setTimeError("Sign in and complete onboarding before adding a new course.");
        return;
      }

      if (!draftEntry.courseName.trim()) {
        setTimeError("Enter a course name for the new course.");
        return;
      }

      const newCourseId = await createCourse(user.uid, activeSemesterId, {
        title: draftEntry.courseName,
        lecturerName: draftEntry.lecturerName,
      });

      selectedCourse = {
        id: newCourseId,
        title: draftEntry.courseName.trim(),
        lecturerName: draftEntry.lecturerName.trim(),
        code: "",
        topicCount: 0,
        latestTopicStatus: "pending",
      };

      setCourses((current) => [...current, selectedCourse as Course]);
      setDraftEntry((current) => ({ ...current, courseId: newCourseId }));
    }

    if (!selectedCourse) {
      setTimeError("Select a course before saving timetable entry.");
      return;
    }

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
          courseId: selectedCourse.id,
          courseName: selectedCourse.title,
          lecturerName: selectedCourse.lecturerName ?? "",
          location: draftEntry.location.trim(),
          durationHours: safeDuration,
        },
      };
    });

    setTimeError(null);
    closeEditor();
  }

  function moveEntry(fromKey: string, targetDay: string, targetSlotKey: string) {
    const targetHour = parseHour(targetSlotKey);
    const sourceKey = fromKey.trim();
    if (!sourceKey) {
      return;
    }

    let nextRequiredEndHour = defaultEndHour;

    setEntries((current) => {
      const draggedEntry = current[sourceKey];
      if (!draggedEntry) {
        return current;
      }

      if (targetHour !== null) {
        const requiredEndHour = Math.min(24, targetHour + Math.max(1, draggedEntry.durationHours));
        if (requiredEndHour > endHour) {
          setEndHour(requiredEndHour);
        }
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

      const nextEntries = {
        ...cleaned,
        [nextKey]: {
          ...draggedEntry,
          durationHours: safeDuration,
        },
      };
      nextRequiredEndHour = requiredEndHourForEntries(nextEntries);
      return nextEntries;
    });

    setEndHour((current) => {
      const desiredEnd = Math.max(defaultEndHour, nextRequiredEndHour);
      if (desiredEnd > current) {
        return desiredEnd;
      }
      if (desiredEnd < current) {
        return desiredEnd;
      }
      return current;
    });
  }

  function updateStartHour(value: string) {
    const normalized = value.trim();
    if (!isValidTimeSlot(normalized)) {
      setTimeError("Use HH:mm format (e.g. 07:00).");
      return;
    }
    const parsedHour = parseHour(normalized);
    if (parsedHour === null || !isValidWindow(parsedHour, endHour)) {
      setTimeError("Start hour must be earlier than end hour.");
      return;
    }
    setStartHour(parsedHour);
    const slotSet = new Set(buildSlots(parsedHour, endHour).map((slot) => slot.key));
    setEntries((current) =>
      Object.fromEntries(Object.entries(current).filter(([entryKey]) => slotSet.has(entryKey.slice(-5)))),
    );
    setTimeError(null);
  }

  function updateEndHour(value: string) {
    const normalized = value.trim();
    if (!isValidTimeSlot(normalized)) {
      setTimeError("Use HH:mm format (e.g. 19:00).");
      return;
    }
    const parsedHour = parseHour(normalized);
    if (parsedHour === null || !isValidWindow(startHour, parsedHour)) {
      setTimeError("End hour must be later than start hour.");
      return;
    }
    setEndHour(parsedHour);
    const slotSet = new Set(buildSlots(startHour, parsedHour).map((slot) => slot.key));
    setEntries((current) =>
      Object.fromEntries(Object.entries(current).filter(([entryKey]) => slotSet.has(entryKey.slice(-5)))),
    );
    setTimeError(null);
  }

  function addHourlyColumn() {
    if (endHour >= 24) {
      setTimeError("Cannot add beyond 24:00.");
      return;
    }
    setEndHour((current) => current + 1);
    setTimeError(null);
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
        return (
          <td key={`${day}-${slot.key}`} colSpan={block.entry.durationHours} className="border-b border-app-border px-1.5 py-1.5">
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
              className={`w-full rounded-md border bg-white px-2.5 py-2 text-left transition hover:bg-app-muted ${
                isActive ? "border-app-accent ring-2 ring-app-accent/25" : "border-app-border"
              } ${isDragging ? "opacity-50" : ""}`}
            >
              <div className="space-y-0.5">
                <p className="truncate text-sm font-medium text-app-fg">
                  {block.entry.courseName || "Class block"}
                </p>
                <p className="truncate text-[11px] text-app-subtle">{block.entry.location || "No location yet"}</p>
              </div>
            </button>
          </td>
        );
      }

      const isActive = editingKey === `${day}-${slot.key}`;
      return (
        <td key={`${day}-${slot.key}`} className="border-b border-app-border px-1.5 py-1.5">
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
            className={`group flex h-[52px] w-full items-center justify-center rounded-md border border-dashed bg-white/70 text-app-subtle transition hover:border-app-accent hover:bg-app-muted ${
              isActive ? "border-app-accent ring-2 ring-app-accent/25" : "border-app-border"
            }`}
            aria-label={`Add class for ${day} at ${slot.label}`}
          >
            <span className="text-lg leading-none opacity-0 transition group-hover:opacity-100 group-hover:text-app-fg group-focus-visible:opacity-100">
              +
            </span>
          </button>
        </td>
      );
    });
  }

  const mobileBlocks = useMemo(() => {
    const blocks: MobileBlock[] = [];
    for (const [entryKey, entry] of Object.entries(entries)) {
      const [day, slotKey] = entryKey.split("-");
      if (!day || !slotKey) {
        continue;
      }
      const hour = parseHour(slotKey);
      const duration = Math.max(1, entry.durationHours);
      const endLabel = hour === null ? "" : hourToLabel(Math.min(23, hour + duration - 1));
      blocks.push({
        day,
        slotKey,
        label: `${hourToLabel(hour ?? 7)}${endLabel ? ` - ${endLabel}` : ""}`,
        entry,
      });
    }
    return blocks.sort((a, b) => {
      const dayDiff = days.indexOf(a.day) - days.indexOf(b.day);
      if (dayDiff !== 0) {
        return dayDiff;
      }
      return a.slotKey.localeCompare(b.slotKey);
    });
  }, [entries]);

  return (
    <div className="space-y-3">
      <header className="space-y-1">
        <p className="text-sm text-app-subtle">Weekly structure</p>
        <h2 className="text-xl font-semibold text-app-fg">Timetable Grid</h2>
        <div className="flex flex-wrap items-center gap-3 text-xs text-app-subtle">
          <p>Hourly grid in GMT. Default range 07:00 to 19:00.</p>
          <span className="rounded-full bg-app-muted px-2 py-1">Saved blocks: {totalFilled}</span>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-app-border bg-panel p-2.5">
        <label className="flex items-center gap-2 text-sm text-app-subtle">
          Start
          <input
            defaultValue={hourToKey(startHour)}
            onBlur={(event) => updateStartHour(event.target.value)}
            className="w-20 rounded-md border border-app-border bg-white px-2 py-1 text-sm text-app-fg outline-none ring-app-accent focus:ring-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-app-subtle">
          End
          <input
            defaultValue={hourToKey(endHour)}
            onBlur={(event) => updateEndHour(event.target.value)}
            className="w-20 rounded-md border border-app-border bg-white px-2 py-1 text-sm text-app-fg outline-none ring-app-accent focus:ring-2"
          />
        </label>
        <button
          type="button"
          onClick={addHourlyColumn}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-app-border bg-white text-lg leading-none text-app-fg hover:bg-app-muted"
          aria-label="Add one hour column"
          title="Add one hour column"
        >
          +
        </button>
      </div>
      {timeError ? <p className="text-sm text-amber-700">{timeError}</p> : null}

      <div className="space-y-2 md:hidden">
        {mobileBlocks.length === 0 ? (
          <p className="rounded-xl border border-app-border bg-panel px-3 py-2 text-sm text-app-subtle">
            No classes yet. Tap a slot on desktop/tablet to start building your week.
          </p>
        ) : (
          mobileBlocks.map((block) => (
            <button
              key={`${block.day}-${block.slotKey}`}
              type="button"
              onClick={() => openEditor(block.day, block.slotKey)}
              className="w-full rounded-xl border border-app-border bg-panel px-3 py-2 text-left"
            >
              <p className="text-xs text-app-subtle">
                {block.day} - {block.label}
              </p>
              <p className="text-sm font-medium text-app-fg">{block.entry.courseName || "Class block"}</p>
              {block.entry.location ? <p className="text-xs text-app-subtle">{block.entry.location}</p> : null}
            </button>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-app-border bg-panel md:block">
        <table className="min-w-[760px] w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-app-border bg-app-muted px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-app-subtle">
                Day
              </th>
              {slots.map((slot) => (
                <th
                  key={slot.key}
                  className="border-b border-app-border bg-app-muted px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-app-subtle"
                >
                  {slot.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day}>
                <td className="sticky left-0 z-10 border-b border-app-border bg-panel px-3 py-2 text-sm font-medium text-app-fg">
                  {day}
                </td>
                {renderDayCells(day)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingKey ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl border border-app-border bg-panel p-5 shadow-xl">
            <h3 className="text-base font-semibold text-app-fg">Update class log</h3>
            <p className="mt-1 text-sm text-app-subtle">Press Enter to save quickly.</p>
            {coursesError ? (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">{coursesError}</p>
            ) : null}
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void saveEditor();
              }}
            >
              <label className="block space-y-1">
                <span className="text-sm text-app-subtle">Course</span>
                <select
                  value={draftEntry.courseId}
                  onChange={(event) => {
                    const courseId = event.target.value;
                    const selected = courses.find((course) => course.id === courseId);
                    setDraftEntry((current) => ({
                      ...current,
                      courseId,
                      courseName: courseId === NEW_COURSE_VALUE ? current.courseName : selected?.title ?? "",
                      lecturerName:
                        courseId === NEW_COURSE_VALUE ? current.lecturerName : selected?.lecturerName ?? "",
                    }));
                  }}
                  className="w-full rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent transition focus:ring-2"
                >
                  <option value="">Select existing course</option>
                  <option value={NEW_COURSE_VALUE}>+ Add new course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
              {draftEntry.courseId === NEW_COURSE_VALUE ? (
                <input
                  value={draftEntry.courseName}
                  onChange={(event) =>
                    setDraftEntry((current) => ({ ...current, courseName: event.target.value }))
                  }
                  placeholder="New course name"
                  className="w-full rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent transition focus:ring-2"
                />
              ) : null}
              <input
                value={draftEntry.lecturerName}
                onChange={(event) =>
                  setDraftEntry((current) => ({ ...current, lecturerName: event.target.value }))
                }
                readOnly={draftEntry.courseId !== NEW_COURSE_VALUE}
                placeholder={
                  draftEntry.courseId === NEW_COURSE_VALUE
                    ? "Lecturer name"
                    : "Lecturer name (from course)"
                }
                className={`w-full rounded-md border border-app-border px-3 py-2 text-sm outline-none ${
                  draftEntry.courseId === NEW_COURSE_VALUE
                    ? "bg-white ring-app-accent transition focus:ring-2"
                    : "bg-app-muted text-app-subtle"
                }`}
              />
              <input
                value={draftEntry.location}
                onChange={(event) =>
                  setDraftEntry((current) => ({ ...current, location: event.target.value }))
                }
                placeholder="Class location"
                className="w-full rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent transition focus:ring-2"
              />
              <label className="block space-y-1">
                <span className="text-sm text-app-subtle">Duration (hours)</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={draftEntry.durationHours}
                  onChange={(event) =>
                    setDraftEntry((current) => ({
                      ...current,
                      durationHours: Math.max(1, Number(event.target.value) || 1),
                    }))
                  }
                  className="w-full rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent transition focus:ring-2"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-md border border-app-border bg-white px-3 py-2 text-sm text-app-fg hover:bg-app-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-app-fg px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
