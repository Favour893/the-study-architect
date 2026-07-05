import { describe, expect, it } from "vitest";
import { buildTimetableImportPlan, attachCourseIdsToEntries } from "../../lib/timetable-import/apply-import";
import { parseImportStartHour, parseTimetableImportPayload } from "../../lib/timetable-import/parse-import";
import type { Course } from "../../lib/types/domain";

describe("parseImportStartHour", () => {
  it("parses 24h and AM/PM times", () => {
    expect(parseImportStartHour(undefined, "09:30")).toBe(9);
    expect(parseImportStartHour(undefined, "2:00 PM")).toBe(14);
    expect(parseImportStartHour(11)).toBe(11);
  });
});

describe("parseTimetableImportPayload", () => {
  it("normalizes days, venues, and merges slot metadata into courses", () => {
    const payload = parseTimetableImportPayload({
      courses: [{ title: "Math 101", code: "MATH101" }],
      slots: [
        {
          day: "mon",
          startTime: "9:00 AM",
          durationHours: 2,
          courseTitle: "Math 101",
          venue: "Room A",
          lecturer: "Dr Smith",
        },
      ],
      startHour: 7,
      endHour: 18,
    });

    expect(payload?.courses[0]?.title).toBe("Math 101");
    expect(payload?.courses[0]?.lecturerName).toBe("Dr Smith");
    expect(payload?.slots[0]?.day).toBe("Monday");
    expect(payload?.slots[0]?.startHour).toBe(9);
    expect(payload?.slots[0]?.location).toBe("Room A");
  });
});

describe("buildTimetableImportPlan", () => {
  const existing: Course[] = [
    {
      id: "c1",
      title: "Physics I",
      topicCount: 0,
      latestTopicStatus: "pending",
    },
  ];

  it("creates courses only when missing", () => {
    const payload = parseTimetableImportPayload({
      courses: [{ title: "Math 101" }, { title: "Physics I" }],
      slots: [
        {
          day: "Tuesday",
          startHour: 10,
          durationHours: 1,
          courseTitle: "Math 101",
        },
      ],
    });
    expect(payload).not.toBeNull();

    const plan = buildTimetableImportPlan(payload!, existing, 7, 19);
    expect(plan.coursesToCreate).toHaveLength(1);
    expect(plan.coursesToCreate[0]?.title).toBe("Math 101");
    expect(plan.courseMatches["physics i"]).toBe("c1");
    expect(plan.entries["Tuesday-10:00"]?.courseName).toBe("Math 101");
  });

  it("matches existing courses by code", () => {
    const existingWithCode: Course[] = [
      {
        id: "c2",
        title: "Engineering Mathematics I",
        code: "MATH 109",
        topicCount: 0,
        latestTopicStatus: "pending",
      },
    ];
    const payload = parseTimetableImportPayload({
      courses: [],
      slots: [
        {
          day: "Wednesday",
          startHour: 8,
          durationHours: 2,
          courseTitle: "Eng Maths I",
          courseCode: "MATH 109",
          location: "LT1",
        },
      ],
    });
    const plan = buildTimetableImportPlan(payload!, existingWithCode, 7, 19);
    expect(plan.coursesToCreate).toHaveLength(0);
    expect(plan.courseMatches["math109"]).toBe("c2");
    expect(Object.values(plan.entries)[0]?.courseId).toBe("c2");
  });

  it("attaches course ids after creation", () => {
    const entries = {
      "Monday-09:00": {
        courseId: "",
        courseName: "Chem 101",
        lecturerName: "",
        location: "",
        durationHours: 1,
      },
    };
    const linked = attachCourseIdsToEntries(entries, { "chem 101": "new-id" });
    expect(linked["Monday-09:00"]?.courseId).toBe("new-id");
  });
});
