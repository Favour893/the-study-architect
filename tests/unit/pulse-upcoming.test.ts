import { describe, expect, it } from "vitest";
import {
  buildExamFeedItems,
  buildTodoFeedItems,
  examRowWhen,
  pickPulseHeadline,
  upcomingWithinDays,
} from "../../lib/pulse/upcoming-items";
import { DEFAULT_EXAM_COLUMNS } from "../../lib/exam-timetable-storage";

describe("examRowWhen", () => {
  it("combines ISO date and 24h time", () => {
    const when = examRowWhen("2026-07-15", "14:30");
    expect(when?.getFullYear()).toBe(2026);
    expect(when?.getMonth()).toBe(6);
    expect(when?.getDate()).toBe(15);
    expect(when?.getHours()).toBe(14);
    expect(when?.getMinutes()).toBe(30);
  });
});

describe("buildTodoFeedItems", () => {
  it("marks overdue todos", () => {
    const now = new Date("2026-07-05T12:00:00");
    const items = buildTodoFeedItems("c1", "Math", [
      {
        id: "t1",
        title: "Revise chapter 3",
        done: false,
        dueAt: "2026-07-01T10:00:00.000Z",
        alarmEnabled: true,
      },
    ], now);
    expect(items[0]?.overdue).toBe(true);
    expect(items[0]?.hasAlarm).toBe(true);
  });
});

describe("buildExamFeedItems", () => {
  it("builds exam items from timetable rows", () => {
    const now = new Date("2026-07-05T12:00:00");
    const items = buildExamFeedItems(
      DEFAULT_EXAM_COLUMNS,
      [
        {
          id: "e1",
          cells: {
            "col-exam-date": "2026-07-15",
            "col-time": "09:00",
            "col-course": "CSC 201",
            "col-venue": "LT1",
          },
          alarmEnabled: true,
          alarmAt: "2026-07-14T20:00:00.000Z",
        },
      ],
      now,
    );
    expect(items[0]?.kind).toBe("exam");
    expect(items[0]?.title).toBe("CSC 201");
    expect(items[0]?.venue).toBe("LT1");
    expect(items[0]?.hasAlarm).toBe(true);
  });
});

describe("pickPulseHeadline", () => {
  it("prefers overdue items", () => {
    const now = new Date("2026-07-05T12:00:00");
    const items = [
      ...buildTodoFeedItems("c1", "Math", [
        { id: "t1", title: "Late task", done: false, dueAt: "2026-07-01T10:00:00.000Z", alarmEnabled: false },
      ], now),
      ...buildExamFeedItems(DEFAULT_EXAM_COLUMNS, [], now),
    ];
    const headline = pickPulseHeadline(items, now);
    expect(headline?.title).toBe("Late task");
  });
});

describe("upcomingWithinDays", () => {
  it("includes items within horizon", () => {
    const now = new Date("2026-07-05T12:00:00");
    const items = buildExamFeedItems(
      DEFAULT_EXAM_COLUMNS,
      [
        {
          id: "e1",
          cells: {
            "col-exam-date": "2026-07-10",
            "col-time": "09:00",
            "col-course": "Near exam",
            "col-venue": "",
          },
          alarmEnabled: false,
          alarmAt: null,
        },
      ],
      now,
    );
    expect(upcomingWithinDays(items, now, 14)).toHaveLength(1);
  });
});
