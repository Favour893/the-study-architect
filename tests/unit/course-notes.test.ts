import { describe, expect, it } from "vitest";
import { firstSentence, noteCardTitle } from "../../lib/course-notes";

describe("course-notes", () => {
  it("uses explicit title when provided", () => {
    expect(
      noteCardTitle({ title: "Week 3 recap", body: "Differentiation rules from lecture." }),
    ).toBe("Week 3 recap");
  });

  it("uses first sentence when title is empty", () => {
    expect(
      noteCardTitle({ title: "", body: "Remember the chain rule. Also review integration." }),
    ).toBe("Remember the chain rule.");
  });

  it("uses first line before sentence punctuation", () => {
    expect(firstSentence("No punctuation here\nSecond line")).toBe("No punctuation here");
  });

  it("returns Untitled note for empty body", () => {
    expect(firstSentence("   ")).toBe("Untitled note");
  });
});
