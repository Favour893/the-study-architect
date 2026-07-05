import { describe, expect, it } from "vitest";
import { buildExamRowsFromImport, parseExamImportPayload } from "../../lib/exam-timetable-import/parse-import";

describe("parseExamImportPayload", () => {
  it("parses exam entries with day, date, course, and venue", () => {
    const payload = parseExamImportPayload({
      entries: [
        {
          day: "Monday",
          date: "2026-05-12",
          course: "MATH 109 - Calculus",
          venue: "LT 1",
          time: "9:00 AM",
        },
      ],
    });
    expect(payload?.entries).toHaveLength(1);
    expect(payload?.entries[0]?.course).toBe("MATH 109 - Calculus");
    expect(payload?.entries[0]?.venue).toBe("LT 1");
  });
});

describe("buildExamRowsFromImport", () => {
  it("maps imported fields to default columns and adds Time column", () => {
    const payload = parseExamImportPayload({
      entries: [
        {
          day: "Wednesday",
          date: "15 May 2026",
          course: "CSC 201",
          venue: "Lab 3",
          time: "2:00 PM",
        },
      ],
    });
    const built = buildExamRowsFromImport(payload!);
    expect(built.rows).toHaveLength(1);
    const row = built.rows[0]!;
    const dayCol = built.columns.find((c) => c.key === "day");
    const courseCol = built.columns.find((c) => c.key === "course");
    const timeCol = built.columns.find((c) => c.key === "time");
    expect(dayCol && row.cells[dayCol.id]).toBe("Wednesday");
    expect(courseCol && row.cells[courseCol.id]).toBe("CSC 201");
    expect(timeCol && row.cells[timeCol.id]).toBe("2:00 PM");
  });

  it("creates extra columns from import extras", () => {
    const payload = parseExamImportPayload({
      entries: [
        {
          course: "PHY 101",
          extras: { Seat: "A12" },
        },
      ],
    });
    const built = buildExamRowsFromImport(payload!);
    const seatCol = built.columns.find((c) => c.label === "Seat");
    expect(seatCol).toBeTruthy();
    expect(seatCol && built.rows[0]?.cells[seatCol.id]).toBe("A12");
  });
});
