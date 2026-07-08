import { describe, expect, it } from "vitest";
import {
  buildClassAlarms,
  buildExamAlarms,
  buildPersonalTodoAlarms,
  mergeAlarms,
} from "../../lib/alarms/build-alarms";
import type { ExamTimetableColumn } from "../../lib/exam-timetable-storage";

describe("build-alarms", () => {
  it("builds personal todo alarms for enabled future todos", () => {
    const due = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const alarms = buildPersonalTodoAlarms([
      {
        id: "t1",
        title: "Problem set",
        done: false,
        dueAt: due,
        alarmEnabled: true,
      },
    ]);
    expect(alarms).toHaveLength(1);
    expect(alarms[0]?.title).toBe("Reminder");
    expect(alarms[0]?.body).toBe("Problem set");
    expect(alarms[0]?.href).toBe("/logs");
    expect(alarms[0]?.id).toBe("personal-todo:t1");
  });

  it("builds class start alarms from timetable storage", () => {
    const now = new Date("2026-07-06T08:00:00");
    const timetable = JSON.stringify({
      entries: {
        "Monday-10:00": { courseName: "Natural gas engineering", location: "Online", durationHours: 1 },
      },
    });
    const alarms = buildClassAlarms(timetable, now, 7);
    expect(alarms.some((alarm) => alarm.body.includes("Natural gas engineering"))).toBe(true);
    expect(alarms[0]?.title).toBe("Class starting now");
  });

  it("builds exam alarms when alarm is enabled", () => {
    const fireAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const columns: ExamTimetableColumn[] = [
      { id: "c1", key: "course", label: "Course" },
    ];
    const alarms = buildExamAlarms(
      "sem-1",
      columns,
      [
        {
          id: "row-1",
          cells: { c1: "Thermodynamics" },
          alarmEnabled: true,
          alarmAt: fireAt,
        },
      ],
    );
    expect(alarms).toHaveLength(1);
    expect(alarms[0]?.body).toBe("Thermodynamics");
  });

  it("deduplicates merged alarms", () => {
    const due = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const alarm = {
      id: "personal-todo:t1",
      fireAt: due,
      title: "A",
      body: "B",
    };
    expect(mergeAlarms([alarm], [alarm])).toHaveLength(1);
  });
});
