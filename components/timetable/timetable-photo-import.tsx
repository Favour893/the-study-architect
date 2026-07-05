"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, ImagePlus, Loader2, ScanLine } from "lucide-react";
import { createCourse } from "@/lib/data/courses";
import {
  attachCourseIdsToEntries,
  buildTimetableImportPlan,
} from "@/lib/timetable-import/apply-import";
import type { TimetableImportPayload } from "@/lib/timetable-import/parse-import";
import type { Course } from "@/lib/types/domain";
import type { TimetableState } from "@/lib/timetable-storage";
import { getClientAuth } from "@/lib/firebase/auth";
import { FORM_PRIMARY_BUTTON_CLASS, FORM_SECONDARY_BUTTON_CLASS } from "@/lib/ui/form-styles";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";

const MAX_BYTES = 5 * 1024 * 1024;

type TimetablePhotoImportProps = {
  courses: Course[];
  activeSemesterId: string | null;
  defaultStartHour: number;
  defaultEndHour: number;
  onCoursesCreated: (courses: Course[]) => void;
  onImportApplied: (payload: {
    entries: TimetableState;
    startHour: number;
    endHour: number;
  }) => void;
};

async function readImageAsBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  if (file.size > MAX_BYTES) {
    throw new Error("Photo must be under 5 MB.");
  }
  const mimeType = file.type || "image/jpeg";
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)) {
    throw new Error("Use a JPEG, PNG, or WebP photo.");
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return { base64: btoa(binary), mimeType };
}

export function TimetablePhotoImport({
  courses,
  activeSemesterId,
  defaultStartHour,
  defaultEndHour,
  onCoursesCreated,
  onImportApplied,
}: TimetablePhotoImportProps) {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [preview, setPreview] = useState<TimetableImportPayload | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handlePointer);
    }
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [menuOpen]);

  async function handleFile(file: File | undefined) {
    setMenuOpen(false);
    if (!file || !user || !activeSemesterId) {
      if (!user || !activeSemesterId) {
        pushToast("Sign in and select a semester first.", "error");
      }
      return;
    }

    setIsScanning(true);
    try {
      const { base64, mimeType } = await readImageAsBase64(file);
      const firebaseUser = getClientAuth().currentUser;
      if (!firebaseUser) {
        pushToast("Sign in to import a timetable photo.", "error");
        return;
      }
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch("/api/import-timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, imageBase64: base64, mimeType }),
      });
      const data = (await res.json()) as TimetableImportPayload & { error?: string };
      if (!res.ok) {
        pushToast(data.error ?? "Could not read that photo.", "error");
        return;
      }
      if (!data.slots?.length && !data.courses?.length) {
        pushToast("No timetable data found in that photo.", "info");
        return;
      }
      setPreview(data);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not read that photo.", "error");
    } finally {
      setIsScanning(false);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      if (cameraRef.current) {
        cameraRef.current.value = "";
      }
    }
  }

  async function applyPreview() {
    if (!preview || !user || !activeSemesterId) {
      return;
    }

    setIsApplying(true);
    try {
      const plan = buildTimetableImportPlan(
        preview,
        courses,
        defaultStartHour,
        defaultEndHour,
      );
      const titleToId = { ...plan.courseMatches };
      const createdCourses: Course[] = [];

      for (const course of plan.coursesToCreate) {
        const id = await createCourse(user.uid, activeSemesterId, {
          title: course.title,
          code: course.code,
          lecturerName: course.lecturerName,
          creditUnits: course.creditUnits,
        });
        titleToId[course.title.trim().toLowerCase()] = id;
        if (course.code) {
          titleToId[course.code.trim().toLowerCase().replace(/\s+/g, "")] = id;
        }
        createdCourses.push({
          id,
          title: course.title.trim(),
          code: course.code ?? "",
          lecturerName: course.lecturerName ?? "",
          creditUnits: course.creditUnits ?? 3,
          topicCount: 0,
          latestTopicStatus: "pending",
        });
      }

      if (createdCourses.length > 0) {
        onCoursesCreated(createdCourses);
      }

      const entries = attachCourseIdsToEntries(plan.entries, titleToId);
      onImportApplied({
        entries,
        startHour: plan.startHour,
        endHour: plan.endHour,
      });

      pushToast(
        `Imported ${Object.keys(entries).length} class block(s) and ${createdCourses.length} new course(s).`,
        "success",
      );
      setPreview(null);
    } catch {
      pushToast("Could not apply the imported timetable.", "error");
    } finally {
      setIsApplying(false);
    }
  }

  const previewPlan = preview
    ? buildTimetableImportPlan(preview, courses, defaultStartHour, defaultEndHour)
    : null;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          disabled={isScanning || !user || !activeSemesterId}
          onClick={() => setMenuOpen((open) => !open)}
          className={`inline-flex items-center gap-1.5 ${FORM_PRIMARY_BUTTON_CLASS}`}
        >
          {isScanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ScanLine className="h-4 w-4" />
          )}
          Import timetable photo
          <ChevronDown className="h-4 w-4 opacity-80" />
        </button>
        {menuOpen ? (
          <div
            className="absolute right-0 top-full z-20 mt-1.5 min-w-[11rem] overflow-hidden rounded-xl border border-app-border bg-panel py-1 shadow-lg"
            role="menu"
          >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-app-fg hover:bg-app-muted"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="h-4 w-4 text-app-accent" />
                Take photo
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-app-fg hover:bg-app-muted"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4 text-app-violet" />
                Upload photo
              </button>
            </div>
          ) : null}
      </div>

      {preview && previewPlan ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-app-border bg-panel shadow-xl">
            <div className="h-1 bg-gradient-to-r from-app-accent to-app-violet" />
            <div className="max-h-[85vh] overflow-y-auto p-5">
              <h3 className="text-base font-semibold text-app-fg">Review import</h3>
              <p className="mt-1 text-sm text-app-subtle">
                {previewPlan.coursesToCreate.length} new course(s) · {Object.keys(previewPlan.entries).length}{" "}
                timetable block(s)
              </p>
              {previewPlan.coursesToCreate.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-app-fg">
                  {previewPlan.coursesToCreate.map((course) => (
                    <li key={course.title} className="rounded-md bg-app-accent-soft/50 px-2 py-1">
                      {course.title}
                      {course.code ? ` · ${course.code}` : ""}
                      {course.lecturerName ? ` · ${course.lecturerName}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs text-app-subtle">
                {Object.entries(previewPlan.entries).map(([key, entry]) => (
                  <li key={key} className="rounded-md border border-app-border px-2 py-1.5 text-app-fg">
                    <span className="font-medium">{key.replace("-", " · ")}</span>
                    <span className="text-app-subtle"> — {entry.courseName}</span>
                    {entry.lecturerName ? (
                      <span className="block text-app-subtle">Lecturer: {entry.lecturerName}</span>
                    ) : null}
                    {entry.location ? (
                      <span className="block text-app-subtle">Venue: {entry.location}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className={FORM_SECONDARY_BUTTON_CLASS}
                  disabled={isApplying}
                  onClick={() => setPreview(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={FORM_PRIMARY_BUTTON_CLASS}
                  disabled={isApplying}
                  onClick={() => void applyPreview()}
                >
                  {isApplying ? "Applying…" : "Apply to timetable"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
