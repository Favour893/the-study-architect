import { extractDocxText, extractPdfText } from "./course-document-parsers";

/** Max characters stored per document (Firestore document size safety). */
export const MAX_COURSE_DOCUMENT_STORE_CHARS = 400_000;

/** Max characters combined when sending imported docs to the AI API. */
export const MAX_COMBINED_DOCUMENT_CONTEXT_CHARS = 28_000;

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "html", "htm", "json"]);
const BINARY_EXTENSIONS = new Set(["pdf", "docx"]);

export const COURSE_DOCUMENT_FILE_ACCEPT =
  ".txt,.md,.markdown,.csv,.html,.htm,.json,.pdf,.docx,text/plain,text/markdown,text/csv,text/html,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const SUPPORTED_FORMATS_MESSAGE =
  "Use .txt, .md, .csv, .html, .json, .pdf, or .docx (max 5 MB). Legacy .doc is not supported — save as .docx.";

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function courseDocumentExtension(fileName: string): string {
  if (!fileName.includes(".")) {
    return "";
  }
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function clampStoredText(text: string): string {
  if (text.length > MAX_COURSE_DOCUMENT_STORE_CHARS) {
    return text.slice(0, MAX_COURSE_DOCUMENT_STORE_CHARS);
  }
  return text;
}

async function readTextExtensionFile(file: File, ext: string): Promise<string> {
  let text = await file.text();
  if (ext === "html" || ext === "htm") {
    text = stripHtmlToText(text);
  }
  return clampStoredText(text);
}

/**
 * Read a user-selected syllabus reference file and extract plain text for storage and AI context.
 */
export async function readImportedCourseFile(file: File): Promise<
  | { ok: true; text: string }
  | { ok: false; error: string }
> {
  const ext = courseDocumentExtension(file.name);

  if (ext === "doc") {
    return { ok: false, error: "Legacy Word .doc files are not supported. Save as .docx and try again." };
  }

  if (!TEXT_EXTENSIONS.has(ext) && !BINARY_EXTENSIONS.has(ext)) {
    return { ok: false, error: SUPPORTED_FORMATS_MESSAGE };
  }

  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "File must be 5 MB or smaller." };
  }

  try {
    let text: string;

    if (ext === "pdf") {
      text = await extractPdfText(file);
      if (!text) {
        return {
          ok: false,
          error: "No readable text found in this PDF. Try a text export or paste content into a .txt file.",
        };
      }
    } else if (ext === "docx") {
      text = await extractDocxText(file);
      if (!text) {
        return {
          ok: false,
          error: "No readable text found in this Word document.",
        };
      }
    } else {
      text = await readTextExtensionFile(file, ext);
    }

    return { ok: true, text: clampStoredText(text) };
  } catch {
    return {
      ok: false,
      error:
        ext === "pdf"
          ? "Could not read this PDF. Make sure it is not password-protected."
          : ext === "docx"
            ? "Could not read this Word file. Try saving it again as .docx."
            : "Could not read this file.",
    };
  }
}
