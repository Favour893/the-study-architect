"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  ListChecks,
  Plus,
  Sparkles,
} from "lucide-react";
import { pickCourseAccent } from "@/lib/ui/accents";
import {
  createTopic,
  listTopics,
  setTopicLearningStage,
  setTopicNotes,
  updateTopicTitle,
  type TopicLearningStage,
} from "@/lib/data/topics";
import {
  addCourseDocument,
  buildCombinedDocumentContextForAi,
  deleteCourseDocument,
  listCourseDocuments,
} from "@/lib/data/course-documents";
import { listCourses } from "@/lib/data/courses";
import { getUserProfile } from "@/lib/data/semesters";
import { readImportedCourseFile, COURSE_DOCUMENT_FILE_ACCEPT } from "@/lib/course-document-import";
import { getClientAuth } from "@/lib/firebase/auth";
import type { Course, CourseDocument, Topic } from "@/lib/types/domain";
import { useAuth } from "@/providers/auth-provider";
import { useSemester } from "@/providers/semester-provider";
import { useToast } from "@/providers/toast-provider";

function normalizeStage(topic: Topic): TopicLearningStage {
  if (topic.learningStage === "pending" || topic.learningStage === "taught" || topic.learningStage === "mastered") {
    return topic.learningStage;
  }
  return topic.taughtInClass ? "taught" : "pending";
}

function stageBadgeClass(stage: TopicLearningStage) {
  if (stage === "mastered") {
    return "bg-emerald-100 text-emerald-950 font-semibold dark:bg-emerald-800 dark:text-emerald-50";
  }
  if (stage === "taught") {
    return "bg-sky-100 text-sky-950 font-semibold dark:bg-sky-800 dark:text-sky-50";
  }
  return "bg-amber-100 text-amber-950 font-semibold dark:bg-amber-800 dark:text-amber-50";
}

/** Readable text on tinted chips and action buttons (light + dark). */
const chipSky =
  "bg-sky-100 text-sky-950 font-semibold dark:bg-sky-800 dark:text-sky-50";
const chipViolet =
  "bg-violet-100 text-violet-950 font-semibold dark:bg-violet-800 dark:text-violet-50";
const chipEmerald =
  "bg-emerald-100 text-emerald-950 font-semibold dark:bg-emerald-800 dark:text-emerald-50";
const btnSkySolid =
  "rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-400";
const btnRoseSolid =
  "shrink-0 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60 dark:bg-rose-700 dark:hover:bg-rose-600";

const inputClass =
  "w-full rounded-md border border-app-border bg-app-accent-soft/30 px-3 py-2 text-sm text-app-fg outline-none ring-app-accent focus:bg-panel focus:ring-2";

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId ?? "";
  const { user } = useAuth();
  const { activeSemesterId, isLoading: semesterLoading } = useSemester();
  const { pushToast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicTitle, setTopicTitle] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [programmeOfStudy, setProgrammeOfStudy] = useState<string | null>(null);
  const [suggestDrafts, setSuggestDrafts] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [courseDocuments, setCourseDocuments] = useState<CourseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const fileImportRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async (uid: string, semesterId: string) => {
    const [profile, courses, nextTopics, docs] = await Promise.all([
      getUserProfile(uid),
      listCourses(uid, semesterId),
      listTopics(uid, semesterId, courseId),
      listCourseDocuments(uid, semesterId, courseId),
    ]);
    setProgrammeOfStudy(profile?.programmeOfStudy?.trim() || null);
    setCourse(courses.find((item) => item.id === courseId) ?? null);
    setTopics(nextTopics);
    setCourseDocuments(docs);
    setNoteDrafts(Object.fromEntries(nextTopics.map((topic) => [topic.id, topic.notes ?? ""])));
    setTitleDrafts(Object.fromEntries(nextTopics.map((topic) => [topic.id, topic.title])));
  }, [courseId]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      if (!user || semesterLoading) {
        return;
      }
      if (!activeSemesterId || !courseId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        await loadData(user.uid, activeSemesterId);
      } catch {
        if (isMounted) {
          pushToast("Could not load course details.", "error");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      isMounted = false;
    };
  }, [user, activeSemesterId, semesterLoading, courseId, pushToast, loadData]);

  function updateSuggestLine(index: number, value: string) {
    setSuggestDrafts((prev) => prev.map((line, i) => (i === index ? value : line)));
  }

  async function handleSuggestTopics() {
    if (!user || !activeSemesterId || !course) {
      return;
    }
    setSuggestError(null);
    const programme = programmeOfStudy?.trim() ?? "";
    if (!programme) {
      setSuggestError("Add your programme of study in the account menu (top right) first.");
      return;
    }

    const auth = getClientAuth();
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setSuggestError("Sign in to use AI suggestions.");
      return;
    }

    let idToken: string;
    try {
      idToken = await firebaseUser.getIdToken();
    } catch {
      setSuggestError("Could not refresh your session.");
      return;
    }

    setSuggestLoading(true);
    try {
      const documentContext = buildCombinedDocumentContextForAi(courseDocuments);
      const res = await fetch("/api/suggest-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          programmeOfStudy: programme,
          courseTitle: course.title,
          courseCode: course.code?.trim() || null,
          existingTopicTitles: topics.map((t) => t.title),
          documentContext,
        }),
      });
      const data = (await res.json()) as { topics?: string[]; error?: string };
      if (!res.ok) {
        setSuggestError(data.error ?? "Could not get suggestions.");
        return;
      }
      if (!Array.isArray(data.topics) || data.topics.length === 0) {
        setSuggestError("No topics returned. Try again.");
        return;
      }
      setSuggestDrafts(data.topics);
    } catch {
      setSuggestError("Network error. Try again.");
    } finally {
      setSuggestLoading(false);
    }
  }

  async function handleImportDocument(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user || !activeSemesterId) {
      return;
    }
    const parsed = await readImportedCourseFile(file);
    if (!parsed.ok) {
      pushToast(parsed.error, "error");
      return;
    }
    setIsSaving(true);
    try {
      await addCourseDocument(user.uid, activeSemesterId, courseId, {
        fileName: file.name,
        mimeType: file.type || "text/plain",
        contentText: parsed.text,
      });
      await loadData(user.uid, activeSemesterId);
      pushToast("Document imported for AI context.", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Could not import document.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteDocument(documentId: string) {
    if (!user || !activeSemesterId) {
      return;
    }
    setIsSaving(true);
    try {
      await deleteCourseDocument(user.uid, activeSemesterId, courseId, documentId);
      await loadData(user.uid, activeSemesterId);
      pushToast("Document removed.", "info");
    } catch {
      pushToast("Could not remove document.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddSuggestedTopics() {
    if (!user || !activeSemesterId) {
      return;
    }
    const existingLower = new Set(topics.map((t) => t.title.trim().toLowerCase()));
    const toAdd = suggestDrafts
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .filter((s) => !existingLower.has(s.toLowerCase()));

    if (toAdd.length === 0) {
      pushToast("No new topics to add (all are already on the list or empty).", "info");
      return;
    }

    setIsSaving(true);
    try {
      for (const title of toAdd) {
        await createTopic(user.uid, activeSemesterId, courseId, { title });
        existingLower.add(title.toLowerCase());
      }
      setSuggestDrafts([]);
      await loadData(user.uid, activeSemesterId);
      pushToast(`Added ${toAdd.length} topic(s).`, "success");
    } catch {
      pushToast("Could not add suggested topics.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddTopic(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !activeSemesterId || !topicTitle.trim()) {
      return;
    }
    setIsSaving(true);
    try {
      await createTopic(user.uid, activeSemesterId, courseId, { title: topicTitle });
      setTopicTitle("");
      await loadData(user.uid, activeSemesterId);
      pushToast("Topic added.", "success");
    } catch {
      pushToast("Could not add topic.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetStage(topicId: string, stage: TopicLearningStage) {
    if (!user || !activeSemesterId) {
      return;
    }
    try {
      await setTopicLearningStage(user.uid, activeSemesterId, courseId, topicId, stage);
      await loadData(user.uid, activeSemesterId);
      pushToast("Topic status updated.", "success");
    } catch {
      pushToast("Could not update topic status.", "error");
    }
  }

  async function handleSaveTopic(topicId: string) {
    if (!user || !activeSemesterId) {
      return;
    }
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) {
      return;
    }
    const title = (titleDrafts[topicId] ?? "").trim();
    if (!title) {
      pushToast("Topic title cannot be empty.", "error");
      return;
    }
    const notes = noteDrafts[topicId] ?? "";
    try {
      if (title !== topic.title) {
        await updateTopicTitle(user.uid, activeSemesterId, courseId, topicId, title);
      }
      if (notes !== (topic.notes ?? "")) {
        await setTopicNotes(user.uid, activeSemesterId, courseId, topicId, notes);
      }
      await loadData(user.uid, activeSemesterId);
      pushToast("Topic saved.", "success");
    } catch {
      pushToast("Could not save topic.", "error");
    }
  }

  const taughtCount = useMemo(
    () => topics.filter((topic) => normalizeStage(topic) === "taught").length,
    [topics],
  );

  const masteredCount = useMemo(
    () => topics.filter((topic) => normalizeStage(topic) === "mastered").length,
    [topics],
  );

  const courseAccent = useMemo(() => pickCourseAccent(courseId), [courseId]);

  const documentContextCharCount = useMemo(
    () => buildCombinedDocumentContextForAi(courseDocuments).length,
    [courseDocuments],
  );

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
          <div className="h-1.5 animate-pulse bg-gradient-to-r from-emerald-500 via-sky-500 to-violet-500" />
          <div className="h-24 animate-pulse bg-app-accent-soft/40 p-6" />
        </div>
        <div className="h-32 animate-pulse rounded-2xl bg-app-muted" />
        <div className="h-28 animate-pulse rounded-2xl bg-app-muted" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="space-y-4 rounded-2xl border border-dashed border-app-border bg-panel p-6 text-center">
        <p className="text-sm text-app-subtle">Course not found in this semester.</p>
        <Link
          href="/courses"
          className="inline-flex items-center gap-2 rounded-lg bg-app-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to courses
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
        <div className={`h-1.5 bg-gradient-to-r ${courseAccent.bar}`} />
        <div className="p-5">
          <Link
            href="/courses"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-app-accent hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to courses
          </Link>
          <div className="flex flex-wrap items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${courseAccent.badge}`}
            >
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-app-teal">Syllabus view</p>
              <h2 className="text-xl font-semibold text-app-fg">{course.title}</h2>
              {course.code ? (
                <p className="mt-0.5 text-sm font-medium text-app-accent">{course.code}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs ${chipViolet}`}>
                  {topics.length} topic{topics.length === 1 ? "" : "s"}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs ${chipSky}`}>
                  {taughtCount} taught
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs ${chipEmerald}`}>
                  {masteredCount} mastered
                </span>
              </div>
              {!programmeOfStudy ? (
                <p className="mt-3 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-50">
                  Add your <span className="font-medium">programme of study</span> in the account menu so AI can
                  suggest topics that match your degree.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
        <div className="h-1 bg-gradient-to-r from-sky-500 to-app-info" />
        <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-200 text-sky-900 dark:bg-sky-800 dark:text-sky-100">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-app-fg">Reference documents</p>
              <p className="mt-1 text-xs text-app-subtle">
                Upload syllabus outlines, module lists, or notes as{" "}
                <span className="font-medium text-app-fg">.txt, .md, .csv, .html, .json, .pdf, or .docx</span> (up to 5
                MB each). Text is extracted and stored with this course for{" "}
                <span className="font-medium">Suggest topics</span>. Scanned PDFs without text may not work — use OCR or
                a .txt copy if needed.
              </p>
              {courseDocuments.length > 0 ? (
                <p className="mt-1 text-xs font-semibold text-app-fg">
                  Combined excerpt sent to AI: ~{documentContextCharCount.toLocaleString()} characters.
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <input
              ref={fileImportRef}
              type="file"
              accept={COURSE_DOCUMENT_FILE_ACCEPT}
              className="hidden"
              onChange={(event) => void handleImportDocument(event)}
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={() => fileImportRef.current?.click()}
              className={btnSkySolid}
            >
              Import document
            </button>
          </div>
        </div>
        {courseDocuments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-sky-200 bg-sky-50/50 px-3 py-2 text-xs text-app-subtle dark:border-sky-900 dark:bg-sky-950/20">
            No documents yet — optional, but they sharpen AI suggestions.
          </p>
        ) : (
          <ul className="divide-y divide-app-border overflow-hidden rounded-xl border border-app-border bg-panel shadow-sm">
            {courseDocuments.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium text-app-fg" title={doc.fileName}>
                  {doc.fileName}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs ${chipSky}`}>
                  {(doc.contentText?.length ?? 0).toLocaleString()} chars
                </span>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleDeleteDocument(doc.id)}
                  className={btnRoseSolid}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm" data-page-guide="course-suggest">
        <div className="h-1 bg-gradient-to-r from-violet-500 to-app-violet" />
        <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-200 text-violet-900 dark:bg-violet-800 dark:text-violet-100">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-app-fg">AI topic suggestions</p>
              <p className="text-xs text-app-subtle">
                Uses your <span className="font-medium text-app-fg">programme</span>, this course, and any{" "}
                <span className="font-medium text-app-fg">reference documents</span> above. Edit lines before adding to
                your syllabus.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={suggestLoading || !programmeOfStudy}
            onClick={() => void handleSuggestTopics()}
            className="shrink-0 rounded-lg bg-gradient-to-r from-app-violet to-app-accent px-3 py-2 text-xs font-medium text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {suggestLoading ? "Suggesting…" : "Suggest topics"}
          </button>
        </div>
        {suggestError ? (
          <p className="rounded-md border border-red-300 bg-red-100 px-3 py-2 text-xs font-medium text-red-950 dark:border-red-700 dark:bg-red-900 dark:text-red-50">
            {suggestError}
          </p>
        ) : null}
        {suggestDrafts.length > 0 ? (
          <form
            className="space-y-2 rounded-xl border border-violet-200 bg-app-violet-soft/30 p-3 dark:border-violet-900/40"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAddSuggestedTopics();
            }}
          >
            <p className="text-xs text-app-subtle">Edit if needed, then add to your syllabus (Enter adds all).</p>
            <ul className="space-y-2">
              {suggestDrafts.map((line, index) => (
                <li key={index}>
                  <input
                    value={line}
                    onChange={(event) => updateSuggestLine(index, event.target.value)}
                    className={inputClass}
                    aria-label={`Suggested topic ${index + 1}`}
                  />
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-md bg-gradient-to-r from-app-violet to-app-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {isSaving ? "Adding…" : "Add all to syllabus"}
              </button>
              <button
                type="button"
                onClick={() => setSuggestDrafts([])}
                className="rounded-md border border-app-border bg-panel px-3 py-1.5 text-sm text-app-fg hover:bg-app-muted"
              >
                Dismiss
              </button>
            </div>
          </form>
        ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm" data-page-guide="course-topics">
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-app-teal" />
        <form onSubmit={handleAddTopic} className="flex flex-wrap items-center gap-2 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100">
              <Plus className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold text-app-fg">Add topic</p>
          </div>
          <input
            value={topicTitle}
            onChange={(event) => setTopicTitle(event.target.value)}
            className={`min-w-0 flex-1 ${inputClass}`}
            placeholder="Add topic (e.g. Thermodynamics)"
          />
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-gradient-to-r from-emerald-600 to-app-teal px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-60"
          >
            {isSaving ? "Adding..." : "Add topic"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <ListChecks className="h-4 w-4 text-app-accent" />
          <h3 className="text-base font-semibold text-app-fg">Your syllabus</h3>
        </div>
        {topics.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-300 bg-app-success-soft/40 px-6 py-8 text-center dark:border-emerald-800">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
              <ListChecks className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
            </div>
            <p className="text-sm font-medium text-app-fg">No topics yet</p>
            <p className="mt-1 text-xs text-app-subtle">
              Add topics manually or use AI suggestions to build your syllabus.
            </p>
          </div>
        ) : (
          topics.map((topic) => {
            const stage = normalizeStage(topic);
            return (
              <form
                key={topic.id}
                className="overflow-hidden rounded-xl border border-app-border bg-panel shadow-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSaveTopic(topic.id);
                }}
              >
                <div className={`h-1 bg-gradient-to-r ${courseAccent.bar}`} />
                <div className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block min-w-0 flex-1 space-y-1">
                    <span className="text-xs font-medium text-app-subtle">Topic title</span>
                    <input
                      value={titleDrafts[topic.id] ?? topic.title}
                      onChange={(event) =>
                        setTitleDrafts((current) => ({ ...current, [topic.id]: event.target.value }))
                      }
                      className={`${inputClass} font-medium`}
                    />
                  </label>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${stageBadgeClass(stage)}`}
                  >
                    {stage === "pending" ? "Not started" : stage}
                  </span>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-app-subtle">Status</span>
                  <select
                    value={stage}
                    onChange={(event) => void handleSetStage(topic.id, event.target.value as TopicLearningStage)}
                    className={inputClass}
                  >
                    <option value="pending">Not Started</option>
                    <option value="taught">Taught in Class</option>
                    <option value="mastered">Mastered</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-app-subtle">Notes</span>
                  <span className="text-[11px] text-app-subtle">Enter saves · Shift+Enter for newline.</span>
                  <textarea
                    value={noteDrafts[topic.id] ?? ""}
                    onChange={(event) =>
                      setNoteDrafts((current) => ({ ...current, [topic.id]: event.target.value }))
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" || event.shiftKey) {
                        return;
                      }
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }}
                    rows={2}
                    placeholder="Add revision notes for this topic..."
                    className={inputClass}
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-md bg-app-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  Save topic
                </button>
                </div>
              </form>
            );
          })
        )}
      </section>
    </div>
  );
}
