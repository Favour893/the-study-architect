/** Max characters stored per document (Firestore document size safety). */
export const MAX_COURSE_DOCUMENT_STORE_CHARS = 400_000;

/** Max characters combined when sending imported docs to the AI API. */
export const MAX_COMBINED_DOCUMENT_CONTEXT_CHARS = 28_000;

const ALLOWED_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "html",
  "htm",
  "json",
]);

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Read a user-selected file as UTF-8 text for supported extensions.
 * PDF and Word are not supported in-browser here.
 */
export async function readImportedCourseFile(file: File): Promise<
  | { ok: true; text: string }
  | { ok: false; error: string }
> {
  const ext = file.name.includes(".") ? (file.name.split(".").pop()?.toLowerCase() ?? "") : "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: "Use a text-based file: .txt, .md, .csv, .html, or .json.",
    };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "File must be 5 MB or smaller." };
  }

  let text = await file.text();
  if (ext === "html" || ext === "htm") {
    text = stripHtmlToText(text);
  }
  if (text.length > MAX_COURSE_DOCUMENT_STORE_CHARS) {
    text = text.slice(0, MAX_COURSE_DOCUMENT_STORE_CHARS);
  }
  return { ok: true, text };
}
