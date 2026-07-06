import { describe, expect, it } from "vitest";
import {
  buildBlockSegments,
  clampDurationToWeek,
  findAnchorKeyForCell,
  getBlockAbsoluteRange,
  removeOverlappingEntries,
} from "../../lib/personal-timetable-grid";

describe("personal-timetable-grid", () => {
  it("splits a block across midnight into the next day", () => {
    const segments = buildBlockSegments("Monday-22:00", 5);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      day: "Monday",
      startIndex: 22,
      spanHours: 2,
      isContinuation: false,
    });
    expect(segments[1]).toMatchObject({
      day: "Tuesday",
      startIndex: 0,
      spanHours: 3,
      isContinuation: true,
    });
  });

  it("clamps duration at the end of the week", () => {
    expect(clampDurationToWeek("Sunday-23:00", 10)).toBe(1);
    const segments = buildBlockSegments("Sunday-23:00", 10);
    expect(segments).toEqual([
      expect.objectContaining({ day: "Sunday", startIndex: 23, spanHours: 1 }),
    ]);
  });

  it("detects absolute overlap across days", () => {
    const mondayNight = getBlockAbsoluteRange("Monday-22:00", 4);
    const tuesdayMorning = getBlockAbsoluteRange("Tuesday-01:00", 2);
    expect(mondayNight && tuesdayMorning).toBeTruthy();
    if (!mondayNight || !tuesdayMorning) {
      return;
    }
    expect(mondayNight.end).toBeGreaterThan(tuesdayMorning.start);
  });

  it("finds anchor key from a continuation cell", () => {
    const entries = {
      "Monday-22:00": { durationHours: 5 },
    };
    expect(findAnchorKeyForCell("Tuesday", 1, entries)).toBe("Monday-22:00");
    expect(findAnchorKeyForCell("Monday", 22, entries)).toBe("Monday-22:00");
  });

  it("removes entries that overlap a multi-day save", () => {
    const entries = {
      "Monday-22:00": { durationHours: 2 },
      "Tuesday-01:00": { durationHours: 1 },
    };
    const cleaned = removeOverlappingEntries(entries, "Monday-23:00", 3);
    expect(cleaned).toEqual({});
  });
});
