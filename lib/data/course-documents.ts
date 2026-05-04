import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { semesterCourseDocumentsPath } from "@/lib/data/paths";
import { getDb } from "@/lib/firebase/db";
import type { CourseDocument } from "@/lib/types/domain";
import { MAX_COMBINED_DOCUMENT_CONTEXT_CHARS } from "@/lib/course-document-import";

const MAX_DOCUMENTS_PER_COURSE = 15;

export async function listCourseDocuments(
  uid: string,
  semesterId: string,
  courseId: string,
): Promise<CourseDocument[]> {
  const db = getDb();
  const ref = collection(db, semesterCourseDocumentsPath(uid, semesterId, courseId));
  const snapshot = await getDocs(query(ref, orderBy("createdAt", "desc")));
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  })) as CourseDocument[];
}

export async function addCourseDocument(
  uid: string,
  semesterId: string,
  courseId: string,
  payload: { fileName: string; mimeType: string; contentText: string },
): Promise<void> {
  const db = getDb();
  const ref = collection(db, semesterCourseDocumentsPath(uid, semesterId, courseId));
  const existing = await getDocs(ref);
  if (existing.size >= MAX_DOCUMENTS_PER_COURSE) {
    throw new Error(`You can import at most ${MAX_DOCUMENTS_PER_COURSE} documents per course.`);
  }

  await addDoc(ref, {
    fileName: payload.fileName.trim().slice(0, 240),
    mimeType: payload.mimeType.slice(0, 120),
    contentText: payload.contentText,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCourseDocument(
  uid: string,
  semesterId: string,
  courseId: string,
  documentId: string,
): Promise<void> {
  const db = getDb();
  const documentRef = doc(db, `${semesterCourseDocumentsPath(uid, semesterId, courseId)}/${documentId}`);
  await deleteDoc(documentRef);
}

/**
 * Newest documents first; concatenate with file headers until max length.
 */
export function buildCombinedDocumentContextForAi(
  docs: CourseDocument[],
  maxTotalChars: number = MAX_COMBINED_DOCUMENT_CONTEXT_CHARS,
): string {
  const sorted = [...docs].sort((a, b) => {
    const ta = timestampMs(a.createdAt);
    const tb = timestampMs(b.createdAt);
    return tb - ta;
  });

  const parts: string[] = [];
  let used = 0;
  for (const d of sorted) {
    const header = `\n--- ${d.fileName} ---\n`;
    const body = d.contentText ?? "";
    const chunk = header + body;
    if (used + chunk.length <= maxTotalChars) {
      parts.push(chunk);
      used += chunk.length;
      continue;
    }
    const remaining = maxTotalChars - used - header.length;
    if (remaining > 200) {
      parts.push(header + body.slice(0, remaining) + "\n[…truncated…]");
    }
    break;
  }
  return parts.join("").trim();
}

function timestampMs(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis: () => number }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}
