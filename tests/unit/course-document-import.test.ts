import { describe, expect, it } from "vitest";
import {
  courseDocumentExtension,
  readImportedCourseFile,
} from "../../lib/course-document-import";

describe("courseDocumentExtension", () => {
  it("returns lowercase extension", () => {
    expect(courseDocumentExtension("Syllabus.PDF")).toBe("pdf");
    expect(courseDocumentExtension("outline.docx")).toBe("docx");
  });
});

describe("readImportedCourseFile", () => {
  it("reads plain text files", async () => {
    const file = new File(["Topic A\nTopic B"], "syllabus.txt", { type: "text/plain" });
    const result = await readImportedCourseFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("Topic A");
    }
  });

  it("rejects legacy .doc files", async () => {
    const file = new File(["binary"], "old.doc", {
      type: "application/msword",
    });
    const result = await readImportedCourseFile(file);
    expect(result).toEqual({
      ok: false,
      error: "Legacy Word .doc files are not supported. Save as .docx and try again.",
    });
  });

  it("rejects unknown extensions", async () => {
    const file = new File(["data"], "notes.xyz", { type: "application/octet-stream" });
    const result = await readImportedCourseFile(file);
    expect(result.ok).toBe(false);
  });
});
