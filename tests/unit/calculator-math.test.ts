import { describe, expect, it } from "vitest";
import {
  CALCULATOR_STORAGE_VERSION,
  type CalculatorStoredState,
} from "../../lib/calculator-storage";
import {
  cumulativeMarkFromSavedStates,
  gradePointFromLetter,
  roundGpaTwoDecimals,
  semesterMarkFromRows,
} from "../../lib/calculator-math";

function makeState(
  rows: CalculatorStoredState["rows"],
  overrides: Partial<CalculatorStoredState> = {},
): CalculatorStoredState {
  return {
    v: CALCULATOR_STORAGE_VERSION,
    mode: "GPA",
    gradeScale: "5.0",
    rows,
    pastCredits: 0,
    pastAverage: 0,
    targetSemesterGpa: 4,
    ...overrides,
  };
}

describe("semesterMarkFromRows", () => {
  it("computes credit-weighted GPA on the 5.0 scale", () => {
    const mark = semesterMarkFromRows(
      [
        { id: "1", title: "Math", units: 3, grade: "A" },
        { id: "2", title: "Physics", units: 2, grade: "B" },
      ],
      "GPA",
      "5.0",
    );
    // (3*5 + 2*4) / 5 = 23/5 = 4.6
    expect(mark).toBe(4.6);
    expect(roundGpaTwoDecimals(mark!)).toBe(4.6);
  });

  it("ignores courses without grades", () => {
    const mark = semesterMarkFromRows(
      [
        { id: "1", title: "Math", units: 3, grade: "A" },
        { id: "2", title: "Physics", units: 2, grade: "" },
      ],
      "GPA",
      "5.0",
    );
    expect(mark).toBe(5);
  });

  it("uses the 4.0 scale mapping", () => {
    expect(gradePointFromLetter("A", "4.0")).toBe(4);
    expect(gradePointFromLetter("B+", "4.0")).toBe(3.5);

    const mark = semesterMarkFromRows(
      [
        { id: "1", title: "Math", units: 3, grade: "A" },
        { id: "2", title: "Physics", units: 3, grade: "B" },
      ],
      "GPA",
      "4.0",
    );
    // (3*4 + 3*3) / 6 = 3.5
    expect(mark).toBe(3.5);
  });
});

describe("cumulativeMarkFromSavedStates", () => {
  it("weights prior semesters by credits, not a simple average", () => {
    const cumulative = cumulativeMarkFromSavedStates(
      [
        makeState([
          { id: "1", title: "A", units: 15, grade: "B" },
        ]),
        makeState([
          { id: "2", title: "B", units: 5, grade: "A" },
        ]),
      ],
      "GPA",
    );
    // Term 1: 15 credits at 4.0 = 60 points
    // Term 2: 5 credits at 5.0 = 25 points
    // Cumulative: 85 / 20 = 4.25 (not (4 + 5) / 2 = 4.5)
    expect(cumulative).toBe(4.25);
  });

  it("skips semesters in a different display mode", () => {
    const cumulative = cumulativeMarkFromSavedStates(
      [
        makeState([{ id: "1", title: "A", units: 3, grade: "A" }], { mode: "CWA" }),
        makeState([{ id: "2", title: "B", units: 3, grade: "B" }], { mode: "GPA" }),
      ],
      "GPA",
    );
    expect(cumulative).toBe(4);
  });
});
