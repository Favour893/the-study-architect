"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createNewSemester,
  setSemesterArchived,
  updateSemesterDetails,
} from "@/lib/data/semesters";
import { useAuth } from "@/providers/auth-provider";
import { useSemester } from "@/providers/semester-provider";
import { useToast } from "@/providers/toast-provider";

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
      pushToast("Semester details updated.");
    } catch {
      pushToast("Could not update semester details.", "error");
    } finally {
      setBusySemesterId(null);
    }
  }

  const otherActiveCandidates = semesters.filter((sem) => sem.id !== activeSemesterId && !sem.isArchived);

  return (
    <section className="mx-auto w-full max-w-2xl space-y-4">
      <div className="rounded-2xl border border-app-border bg-panel p-6 md:p-8">
        <header className="mb-6 space-y-2">
          <p className="text-sm uppercase tracking-wide text-app-subtle">Manage semesters</p>
          <h2 className="text-2xl font-semibold text-app-fg">Archive or restore semesters</h2>
          <p className="text-sm text-app-subtle">
            Archiving hides a semester from active use but keeps all its data. You can unarchive later.
          </p>
        </header>

        <div className="space-y-2">
          {semesters.map((sem) => {
            const isCurrent = sem.id === activeSemesterId;
            const isBusy = busySemesterId === sem.id;
            const isEditing = editingSemesterId === sem.id;
            const canArchiveCurrent = otherActiveCandidates.length > 0;
            const disableArchive = isCurrent && !sem.isArchived && !canArchiveCurrent;

            return (
              <div
                key={sem.id}
                className="rounded-lg border border-app-border bg-white px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-app-fg">
                      {sem.name}
                      {isCurrent ? " (current)" : ""}
                      {sem.isArchived ? " (archived)" : ""}
                    </p>
                    <p className="text-xs text-app-subtle">
                      {sem.startDate} to {sem.endDate}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={isBusy || (editingSemesterId !== null && !isEditing)}
                      onClick={() => (isEditing ? cancelEdit() : beginEdit(sem.id))}
                      className="rounded-md border border-app-border bg-white px-3 py-1.5 text-xs text-app-fg hover:bg-app-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isEditing ? "Cancel edit" : "Edit"}
                    </button>
                    {isCurrent ? null : (
                      <button
                        type="button"
                        onClick={() => void setActiveSemester(sem.id)}
                        className="rounded-md border border-app-border bg-white px-3 py-1.5 text-xs text-app-fg hover:bg-app-muted"
                      >
                        Switch
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isBusy || disableArchive}
                      onClick={() => void handleToggleArchive(sem.id, !sem.isArchived)}
                      className="rounded-md border border-app-border bg-white px-3 py-1.5 text-xs text-app-fg hover:bg-app-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBusy ? "Saving..." : sem.isArchived ? "Unarchive" : "Archive"}
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <form
                    className="mt-3 grid gap-2 rounded-md border border-app-border bg-panel p-3 sm:grid-cols-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveEdit(sem.id);
                    }}
                  >
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2 sm:col-span-3"
                      placeholder="Semester name"
                    />
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={(event) => setEditStartDate(event.target.value)}
                      className="rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
                    />
                    <input
                      type="date"
                      value={editEndDate}
                      onChange={(event) => setEditEndDate(event.target.value)}
                      className="rounded-md border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
                    />
                    <button
                      type="submit"
                      disabled={isBusy}
                      className="rounded-md bg-app-fg px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBusy ? "Saving..." : "Save changes"}
                    </button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
        {!otherActiveCandidates.length && activeSemesterId ? (
          <p className="mt-2 text-xs text-app-subtle">
            Add or switch to another active semester before archiving the current one.
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-app-border bg-panel p-6 md:p-8">
      <header className="mb-6 space-y-2">
        <p className="text-sm uppercase tracking-wide text-app-subtle">Semesters</p>
        <h2 className="text-2xl font-semibold text-app-fg">Start a new semester</h2>
        <p className="text-sm text-app-subtle">
          Creates a fresh semester vault and switches the app to it. Course topics are not copied—only course shells when
          you opt in below.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block space-y-1">
          <span className="text-sm text-app-subtle">Semester name</span>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-app-border bg-white px-3 py-2 outline-none ring-app-accent transition focus:ring-2"
            placeholder="Rain 2027"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm text-app-subtle">Start date</span>
            <input
              required
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-lg border border-app-border bg-white px-3 py-2 outline-none ring-app-accent transition focus:ring-2"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-app-subtle">End date</span>
            <input
              required
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-lg border border-app-border bg-white px-3 py-2 outline-none ring-app-accent transition focus:ring-2"
            />
          </label>
        </div>

        {semesters.length > 0 ? (
          <label className="block space-y-1">
            <span className="text-sm text-app-subtle">Copy course list from…</span>
            <select
              value={copyFromId}
              onChange={(event) => setCopyFromId(event.target.value)}
              className="w-full rounded-lg border border-app-border bg-white px-3 py-2 outline-none ring-app-accent transition focus:ring-2"
            >
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

        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-app-fg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating semester…" : "Create semester & switch to it"}
        </button>
      </form>
      </div>
    </section>
  );
}
