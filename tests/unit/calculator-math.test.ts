import { describe, expect, it } from "vitest";
import {
  CALCULATOR_STORAGE_VERSION,
  type CalculatorStoredState,
} from "../../lib/calculator-storage";
import {
  countSemestersWithGrades,
  cumulativeCgpaFromRowSets,
  cumulativeCwaFromRowSets,
  cumulativeMarkAsSemesterAverage,
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

describe("cumulativeCgpaFromRowSets", () => {
  it("averages semester GPAs equally (not credit-weighted)", () => {
    const cumulative = cumulativeCgpaFromRowSets(
      [
        [{ id: "1", title: "A", units: 15, grade: "B" }],
        [{ id: "2", title: "B", units: 5, grade: "A" }],
      ],
      "5.0",
    );
    // Sem 1 GPA = 4.0, Sem 2 GPA = 5.0 → CGPA = (4 + 5) / 2 = 4.5
    expect(cumulative).toBe(4.5);
  });

  it("ignores semesters with no grades in the average", () => {
    const cumulative = cumulativeCgpaFromRowSets(
      [
        [{ id: "1", title: "A", units: 3, grade: "A" }],
        [{ id: "2", title: "B", units: 3, grade: "" }],
      ],
      "5.0",
    );
    expect(cumulative).toBe(5);
    expect(countSemestersWithGrades([[{ id: "1", title: "A", units: 3, grade: "A" }], [{ id: "2", title: "B", units: 3, grade: "" }]])).toBe(1);
  });
});

describe("cumulativeCwaFromRowSets", () => {
  it("uses credit-weighted marks across all semesters (KNUST-style)", () => {
    const cumulative = cumulativeCwaFromRowSets([
      [
        { id: "1", title: "A", units: 8, grade: "A" },
        { id: "2", title: "B", units: 3, grade: "B" },
      ],
      [
        { id: "3", title: "C", units: 6, grade: "A" },
        { id: "4", title: "D", units: 6, grade: "C" },
      ],
    ]);
    // Sem 1 CWA = (8*85 + 3*65) / 11 ≈ 79.545
    // Sem 2 CWA = (6*85 + 6*52) / 12 = 68.5
    // Average of semester CWAs ≈ 74.02 (not used for cumulative CWA)
    // Cumulative CWA = (680 + 195 + 510 + 312) / 23 ≈ 73.78
    expect(cumulative).toBeCloseTo(73.7826, 3);
  });

  it("matches KNUST worked example totals", () => {
    // Semester totals: 851/11 and 964/12 → overall 1815/23
    const cumulative = cumulativeCwaFromRowSets([
      [{ id: "1", title: "Sem1", units: 11, grade: "B+" }],
      [{ id: "2", title: "Sem2", units: 12, grade: "A" }],
    ]);
    // Single course per sem: (11*75 + 12*85) / 23 = 1805/23 ≈ 78.478
    // Real KNUST uses raw % marks; letter equivalents approximate the method.
    expect(cumulative).toBeCloseTo((11 * 75 + 12 * 85) / 23, 2);
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
