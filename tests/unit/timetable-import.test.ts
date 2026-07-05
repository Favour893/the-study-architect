import { describe, expect, it } from "vitest";
import { buildTimetableImportPlan, attachCourseIdsToEntries } from "../../lib/timetable-import/apply-import";
import { parseTimetableImportPayload } from "../../lib/timetable-import/parse-import";
import type { Course } from "../../lib/types/domain";

describe("parseTimetableImportPayload", () => {
  it("normalizes days and hours", () => {
    const payload = parseTimetableImportPayload({
      courses: [{ title: "Math 101", code: "MATH101" }],
      slots: [
        {
          day: "mon",
          startHour: 9,
          durationHours: 2,
          courseTitle: "Math 101",
          location: "Room A",
        },
      ],
      startHour: 7,
      endHour: 18,
    });

    expect(payload?.courses[0]?.title).toBe("Math 101");
    expect(payload?.slots[0]?.day).toBe("Monday");
    expect(payload?.slots[0]?.durationHours).toBe(2);
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
