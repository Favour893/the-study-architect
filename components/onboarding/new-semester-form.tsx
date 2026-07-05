"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, CalendarDays, Pencil, Plus, Sparkles } from "lucide-react";
import {
  createNewSemester,
  setSemesterArchived,
  updateSemesterDetails,
} from "@/lib/data/semesters";
import { pickSemesterAccent } from "@/lib/ui/accents";
import { useAuth } from "@/providers/auth-provider";
import { useSemester } from "@/providers/semester-provider";
import { useToast } from "@/providers/toast-provider";

const inputClass =
  "w-full rounded-lg border border-app-border bg-app-accent-soft/40 px-3 py-2 text-app-fg outline-none ring-app-accent transition focus:bg-panel focus:ring-2";

export function NewSemesterForm() {
  const { user } = useAuth();
  const router = useRouter();
  const { pushToast } = useToast();
  const { semesters, activeSemesterId, setActiveSemester, refreshSemesters } = useSemester();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [copyFromId, setCopyFromId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busySemesterId, setBusySemesterId] = useState<string | null>(null);
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!user) {
      setError("You must be signed in.");
      return;
    }

    if (!name.trim()) {
      setError("Enter a semester name.");
      return;
    }

    if (!startDate || !endDate) {
      setError("Choose start and end dates.");
      return;
    }

    if (endDate < startDate) {
      setError("End date must be on or after the start date.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createNewSemester(user.uid, {
        name: name.trim(),
        startDate,
        endDate,
        copyCoursesFromSemesterId: copyFromId.trim() || null,
      });
      await refreshSemesters();
      router.replace("/dashboard");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create semester.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleArchive(semesterId: string, nextArchived: boolean) {
    if (!user) {
      return;
    }
    setBusySemesterId(semesterId);
    try {
      await setSemesterArchived(user.uid, semesterId, nextArchived);
      await refreshSemesters();
      pushToast(nextArchived ? "Semester archived." : "Semester unarchived.");
    } catch {
      pushToast("Could not update semester archive state.", "error");
    } finally {
      setBusySemesterId(null);
    }
  }

  function beginEdit(semesterId: string) {
    const semester = semesters.find((sem) => sem.id === semesterId);
    if (!semester) {
      return;
    }
    setEditingSemesterId(semesterId);
    setEditName(semester.name);
    setEditStartDate(semester.startDate);
    setEditEndDate(semester.endDate);
  }

  function cancelEdit() {
    setEditingSemesterId(null);
    setEditName("");
    setEditStartDate("");
    setEditEndDate("");
  }

  async function saveEdit(semesterId: string) {
    if (!user) {
      return;
    }
    if (!editName.trim()) {
      pushToast("Semester name cannot be empty.", "error");
      return;
    }
    if (!editStartDate || !editEndDate) {
      pushToast("Start and end dates are required.", "error");
      return;
    }
    if (editEndDate < editStartDate) {
      pushToast("End date must be on or after start date.", "error");
      return;
    }
    setBusySemesterId(semesterId);
    try {
      await updateSemesterDetails(user.uid, semesterId, {
        name: editName,
        startDate: editStartDate,
        endDate: editEndDate,
      });
      await refreshSemesters();
      cancelEdit();
      pushToast("Semester details updated.", "success");
    } catch {
      pushToast("Could not update semester details.", "error");
    } finally {
      setBusySemesterId(null);
    }
  }

  const otherActiveCandidates = semesters.filter((sem) => sem.id !== activeSemesterId && !sem.isArchived);

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6">
      <header className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-rose-500 via-violet-500 to-sky-500" />
        <div className="flex items-start gap-4 p-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 to-violet-500/20 ring-1 ring-rose-300/30">
            <CalendarDays className="h-6 w-6 text-rose-600 dark:text-rose-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-app-violet">Semester hub</p>
            <h1 className="mt-0.5 text-2xl font-semibold text-app-fg">Your academic terms</h1>
            <p className="mt-1 text-sm text-app-subtle">
              Switch between terms, archive old ones, or start fresh for a new semester.
            </p>
          </div>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
        <div className="h-1 bg-gradient-to-r from-amber-400 to-rose-500" />
        <div className="p-6 md:p-8">
          <header className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/50">
              <Archive className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-app-fg">Manage semesters</h2>
              <p className="text-sm text-app-subtle">Archive or restore without losing data.</p>
            </div>
          </header>

          <div className="space-y-3">
            {semesters.map((sem) => {
              const isCurrent = sem.id === activeSemesterId;
              const isBusy = busySemesterId === sem.id;
              const isEditing = editingSemesterId === sem.id;
              const canArchiveCurrent = otherActiveCandidates.length > 0;
              const disableArchive = isCurrent && !sem.isArchived && !canArchiveCurrent;
              const accent = pickSemesterAccent(sem.id);

              return (
                <div
                  key={sem.id}
                  className={`overflow-hidden rounded-xl border border-app-border bg-panel shadow-sm ${accent.border} border-l-4`}
                >
                  <div className={`h-1 bg-gradient-to-r ${accent.bar}`} />
                  <div className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-app-fg">{sem.name}</p>
                          {isCurrent ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Current
                            </span>
                          ) : null}
                          {sem.isArchived ? (
                            <span className="rounded-full bg-app-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-app-subtle">
                              Archived
                            </span>
                          ) : (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${accent.badge}`}>
                              Active
                            </span>
                          )}
                        </div>
                        <p className="flex items-center gap-1.5 text-xs text-app-subtle">
                          <CalendarDays className="h-3.5 w-3.5 text-app-accent" />
                          {sem.startDate} → {sem.endDate}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isBusy || (editingSemesterId !== null && !isEditing)}
                          onClick={() => (isEditing ? cancelEdit() : beginEdit(sem.id))}
                          className="inline-flex items-center gap-1 rounded-md border border-app-border bg-app-accent-soft px-3 py-1.5 text-xs font-medium text-app-accent hover:bg-app-accent-light disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Pencil className="h-3 w-3" />
                          {isEditing ? "Cancel" : "Edit"}
                        </button>
                        {isCurrent ? null : (
                          <button
                            type="button"
                            onClick={() => void setActiveSemester(sem.id)}
                            className="rounded-md bg-app-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                          >
                            Switch
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy || disableArchive}
                          onClick={() => void handleToggleArchive(sem.id, !sem.isArchived)}
                          className="rounded-md border border-amber-300/60 bg-app-amber-soft px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-300"
                        >
                          {isBusy ? "Saving..." : sem.isArchived ? "Unarchive" : "Archive"}
                        </button>
                      </div>
                    </div>

                    {isEditing ? (
                      <form
                        className="mt-3 grid gap-2 rounded-lg border border-app-border bg-app-accent-soft/30 p-3 sm:grid-cols-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveEdit(sem.id);
                        }}
                      >
                        <input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          className={`${inputClass} sm:col-span-3`}
                          placeholder="Semester name"
                        />
                        <label className="block space-y-1">
                          <span className="text-xs text-app-subtle">Start</span>
                          <input
                            type="date"
                            value={editStartDate}
                            onChange={(event) => setEditStartDate(event.target.value)}
                            className={`${inputClass} w-full`}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs text-app-subtle">End</span>
                          <input
                            type="date"
                            value={editEndDate}
                            onChange={(event) => setEditEndDate(event.target.value)}
                            className={`${inputClass} w-full`}
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={isBusy}
                          className="rounded-md bg-gradient-to-r from-app-accent to-app-violet px-3 py-2 text-sm font-medium text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? "Saving..." : "Save changes"}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {!otherActiveCandidates.length && activeSemesterId ? (
            <p className="mt-3 rounded-lg bg-app-amber-soft px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              Add or switch to another active semester before archiving the current one.
            </p>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
        <div className="h-1 bg-gradient-to-r from-sky-500 to-emerald-500" />
        <div className="p-6 md:p-8">
          <header className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/50">
              <Plus className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-app-fg">Start a new semester</h2>
              <p className="text-sm text-app-subtle">
                Fresh vault — optionally copy course shells from a previous term.
              </p>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-app-accent">Semester name</span>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
                placeholder="Rain 2027"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-app-teal">Start date</span>
                <input
                  required
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-app-coral">End date</span>
                <input
                  required
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            {semesters.length > 0 ? (
              <label className="block space-y-1">
                <span className="text-sm font-medium text-app-violet">Copy course list from…</span>
                <select value={copyFromId} onChange={(event) => setCopyFromId(event.target.value)} className={inputClass}>
                  <option value="">Don&apos;t copy courses</option>
                  {semesters.map((sem) => (
                    <option key={sem.id} value={sem.id}>
                      {sem.name}
                      {sem.id === activeSemesterId ? " (current)" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-app-subtle">
                  Copies titles, codes, and lecturer fields only—empty topic lists for each course.
                </p>
              </label>
            ) : null}

            {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-app-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-emerald-600/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {isSubmitting ? "Creating semester…" : "Create semester & switch to it"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
