"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { readImportedCourseFile } from "@/lib/course-document-import";
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
      pushToast("Document imported for AI context.", "info");
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
      pushToast(`Added ${toAdd.length} topic(s).`, "info");
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
      pushToast("Topic saved.");
    } catch {
      pushToast("Could not save topic.", "error");
    }
  }

  const taughtCount = useMemo(
    () => topics.filter((topic) => normalizeStage(topic) === "taught").length,
    [topics],
  );

  const documentContextCharCount = useMemo(
    () => buildCombinedDocumentContextForAi(courseDocuments).length,
    [courseDocuments],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-12 animate-pulse rounded-xl bg-app-muted" />
        <div className="h-28 animate-pulse rounded-xl bg-app-muted" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-app-subtle">Course not found in this semester.</p>
        <Link href="/courses" className="inline-flex rounded-md border border-app-border bg-white px-3 py-2 text-sm text-app-fg">
          Back to courses
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="text-sm text-app-subtle">Syllabus view</p>
        <h2 className="text-xl font-semibold text-app-fg">{course.title}</h2>
        <p className="text-sm text-app-subtle">
          Topics: {topics.length} total, {taughtCount} taught and waiting for mastery.
        </p>
        {!programmeOfStudy ? (
          <p className="text-xs text-amber-800">
            Add your <span className="font-medium">programme of study</span> in the account menu (icon, top right) so AI
            can suggest syllabus topics that match your degree.
          </p>
        ) : null}
      </header>

      <section className="space-y-3 rounded-xl border border-app-border bg-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-app-fg">Reference documents</p>
            <p className="mt-1 text-xs text-app-subtle">
              Upload syllabus outlines, module lists, or notes as{" "}
              <span className="font-medium text-app-fg">.txt, .md, .csv, .html, or .json</span> (up to 5 MB each). Text
              is stored with this course and included when you run <span className="font-medium">Suggest topics</span> so
              the AI can follow your real scope. PDF/DOCX are not supported in-app yet — paste into a .txt file if
              needed.
            </p>
            {courseDocuments.length > 0 ? (
              <p className="mt-1 text-xs text-app-subtle">
                Combined excerpt sent to AI: ~{documentContextCharCount.toLocaleString()} characters.
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <input
              ref={fileImportRef}
              type="file"
              accept=".txt,.md,.markdown,.csv,.html,.htm,.json,text/plain,text/markdown,text/csv,text/html,application/json"
              className="hidden"
              onChange={(event) => void handleImportDocument(event)}
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={() => fileImportRef.current?.click()}
              className="rounded-lg border border-app-border bg-white px-3 py-2 text-xs font-medium text-app-fg hover:bg-app-muted disabled:opacity-60"
            >
              Import document
            </button>
          </div>
        </div>
        {courseDocuments.length === 0 ? (
          <p className="text-xs text-app-subtle">No documents yet — optional, but they sharpen AI suggestions.</p>
        ) : (
          <ul className="divide-y divide-app-border rounded-lg border border-app-border bg-white">
            {courseDocuments.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium text-app-fg" title={doc.fileName}>
                  {doc.fileName}
                </span>
                <span className="text-xs text-app-subtle">
                  {(doc.contentText?.length ?? 0).toLocaleString()} chars
                </span>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleDeleteDocument(doc.id)}
                  className="shrink-0 rounded-md border border-app-border px-2 py-1 text-xs text-app-fg hover:bg-app-muted disabled:opacity-60"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-3 rounded-xl border border-app-border bg-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-app-fg">AI topic suggestions</p>
            <p className="text-xs text-app-subtle">
              Suggestions use your <span className="font-medium text-app-fg">programme</span>, this course, and any{" "}
              <span className="font-medium text-app-fg">reference documents</span> above. Edit lines below before adding
              them to your syllabus.
            </p>
          </div>
          <button
            type="button"
            disabled={suggestLoading || !programmeOfStudy}
            onClick={() => void handleSuggestTopics()}
            className="shrink-0 rounded-lg bg-app-fg px-3 py-2 text-xs font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {suggestLoading ? "Suggesting…" : "Suggest topics"}
          </button>
        </div>
        {suggestError ? <p className="text-xs text-red-700">{suggestError}</p> : null}
        {suggestDrafts.length > 0 ? (
          <form
            className="space-y-2"
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
                    className="w-full rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
                    aria-label={`Suggested topic ${index + 1}`}
                  />
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-md bg-app-fg px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {isSaving ? "Adding…" : "Add all to syllabus"}
              </button>
              <button
                type="button"
                onClick={() => setSuggestDrafts([])}
                className="rounded-md border border-app-border bg-white px-3 py-1.5 text-sm text-app-fg hover:bg-app-muted"
              >
                Dismiss
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <form onSubmit={handleAddTopic} className="flex gap-2 rounded-xl border border-app-border bg-panel p-3">
        <input
          value={topicTitle}
          onChange={(event) => setTopicTitle(event.target.value)}
          className="w-full rounded-lg border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
          placeholder="Add topic (e.g. Thermodynamics)"
        />
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg border border-app-border bg-white px-3 py-2 text-sm font-medium text-app-fg hover:bg-app-muted disabled:opacity-60"
        >
          {isSaving ? "Adding..." : "Add topic"}
        </button>
      </form>

      <div className="space-y-2">
        {topics.length === 0 ? (
          <p className="text-sm text-app-subtle">No topics yet.</p>
        ) : (
          topics.map((topic) => {
            const stage = normalizeStage(topic);
            return (
              <form
                key={topic.id}
                className="space-y-2 rounded-xl border border-app-border bg-panel p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSaveTopic(topic.id);
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block min-w-0 flex-1 space-y-1">
                    <span className="text-xs text-app-subtle">Topic title</span>
                    <input
                      value={titleDrafts[topic.id] ?? topic.title}
                      onChange={(event) =>
                        setTitleDrafts((current) => ({ ...current, [topic.id]: event.target.value }))
                      }
                      className="w-full rounded-md border border-app-border bg-white px-3 py-2 text-sm font-medium text-app-fg outline-none ring-app-accent focus:ring-2"
                    />
                  </label>
                  <span className="shrink-0 rounded-full bg-app-muted px-2 py-0.5 text-xs text-app-subtle">{stage}</span>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs text-app-subtle">Status</span>
                  <select
                    value={stage}
                    onChange={(event) => void handleSetStage(topic.id, event.target.value as TopicLearningStage)}
                    className="w-full rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
                  >
                    <option value="pending">Not Started</option>
                    <option value="taught">Taught in Class</option>
                    <option value="mastered">Mastered</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-app-subtle">Notes</span>
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
                    className="w-full rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-md border border-app-border bg-white px-3 py-1.5 text-sm text-app-fg hover:bg-app-muted"
                >
                  Save topic
                </button>
              </form>
            );
          })
        )}
      </div>
    </div>
  );
}
