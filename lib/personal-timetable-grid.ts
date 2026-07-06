import { PERSONAL_TIMETABLE_DAYS, type PersonalTimetableDay } from "./personal-timetable-storage";

export const PERSONAL_SLOTS_PER_DAY = 24;

export type PersonalBlockSegment = {
  anchorKey: string;
  day: PersonalTimetableDay;
  startIndex: number;
  spanHours: number;
  isContinuation: boolean;
};

export type AbsoluteRange = {
  start: number;
  end: number;
};

export function parsePersonalEntryKey(key: string): { day: PersonalTimetableDay; slotKey: string } | null {
  const dashIndex = key.indexOf("-");
  if (dashIndex <= 0) {
    return null;
  }
  const day = key.slice(0, dashIndex) as PersonalTimetableDay;
  if (!PERSONAL_TIMETABLE_DAYS.includes(day)) {
    return null;
  }
  return { day, slotKey: key.slice(dashIndex + 1) };
}

export function slotKeyToIndex(slotKey: string): number {
  const hour = Number(slotKey.slice(0, 2));
  if (Number.isNaN(hour) || hour < 0 || hour >= PERSONAL_SLOTS_PER_DAY) {
    return -1;
  }
  return hour;
}

export function dayToIndex(day: PersonalTimetableDay): number {
  return PERSONAL_TIMETABLE_DAYS.indexOf(day);
}

export function indexToDay(dayIndex: number): PersonalTimetableDay | null {
  return PERSONAL_TIMETABLE_DAYS[dayIndex] ?? null;
}

export function slotIndexToKey(index: number): string {
  return `${String(index).padStart(2, "0")}:00`;
}

export function getBlockAbsoluteRange(anchorKey: string, durationHours: number): AbsoluteRange | null {
  const parsed = parsePersonalEntryKey(anchorKey);
  if (!parsed) {
    return null;
  }
  const dayIndex = dayToIndex(parsed.day);
  const startIndex = slotKeyToIndex(parsed.slotKey);
  if (dayIndex < 0 || startIndex < 0) {
    return null;
  }
  const start = dayIndex * PERSONAL_SLOTS_PER_DAY + startIndex;
  const weekSlots = PERSONAL_TIMETABLE_DAYS.length * PERSONAL_SLOTS_PER_DAY;
  const end = Math.min(weekSlots, start + Math.max(1, durationHours));
  return { start, end };
}

export function absoluteRangesOverlap(left: AbsoluteRange, right: AbsoluteRange) {
  return left.start < right.end && right.start < left.end;
}

export function clampDurationToWeek(anchorKey: string, durationHours: number): number {
  const range = getBlockAbsoluteRange(anchorKey, durationHours);
  if (!range) {
    return 1;
  }
  return Math.max(1, range.end - range.start);
}

export function buildBlockSegments(anchorKey: string, durationHours: number): PersonalBlockSegment[] {
  const parsed = parsePersonalEntryKey(anchorKey);
  if (!parsed) {
    return [];
  }

  let dayIndex = dayToIndex(parsed.day);
  let slotIndex = slotKeyToIndex(parsed.slotKey);
  if (dayIndex < 0 || slotIndex < 0) {
    return [];
  }

  const safeDuration = clampDurationToWeek(anchorKey, durationHours);
  let remaining = safeDuration;
  const segments: PersonalBlockSegment[] = [];

  while (remaining > 0 && dayIndex < PERSONAL_TIMETABLE_DAYS.length) {
    const day = PERSONAL_TIMETABLE_DAYS[dayIndex];
    if (!day) {
      break;
    }
    const hoursLeftInDay = PERSONAL_SLOTS_PER_DAY - slotIndex;
    const spanHours = Math.min(remaining, hoursLeftInDay);
    segments.push({
      anchorKey,
      day,
      startIndex: slotIndex,
      spanHours,
      isContinuation: segments.length > 0,
    });
    remaining -= spanHours;
    dayIndex += 1;
    slotIndex = 0;
  }

  return segments;
}

export function findAnchorKeyForCell(
  day: PersonalTimetableDay,
  slotIndex: number,
  entries: Record<string, { durationHours: number }>,
): string | null {
  for (const [anchorKey, entry] of Object.entries(entries)) {
    for (const segment of buildBlockSegments(anchorKey, entry.durationHours)) {
      if (
        segment.day === day &&
        slotIndex >= segment.startIndex &&
        slotIndex < segment.startIndex + segment.spanHours
      ) {
        return anchorKey;
      }
    }
  }
  return null;
}

export function removeOverlappingEntries(
  entries: Record<string, { durationHours: number }>,
  anchorKey: string,
  durationHours: number,
  exceptKey?: string,
): Record<string, { durationHours: number }> {
  const nextRange = getBlockAbsoluteRange(anchorKey, durationHours);
  if (!nextRange) {
    return entries;
  }

  const cleaned: Record<string, { durationHours: number }> = {};
  for (const [existingKey, existingValue] of Object.entries(entries)) {
    if (existingKey === exceptKey) {
      continue;
    }
    const existingRange = getBlockAbsoluteRange(existingKey, existingValue.durationHours);
    if (!existingRange || !absoluteRangesOverlap(nextRange, existingRange)) {
      cleaned[existingKey] = existingValue;
    }
  }
  return cleaned;
}
