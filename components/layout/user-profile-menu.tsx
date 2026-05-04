"use client";

import { signOutUser } from "@/lib/firebase/auth";
import { getUserProfile, updateUserProfileProgramme } from "@/lib/data/semesters";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { CircleUser } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function UserProfileMenu() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [programmeDraft, setProgrammeDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handlePointer);
    }
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [open]);

  useEffect(() => {
    if (!open || !user) {
      return;
    }
    let cancelled = false;
    void getUserProfile(user.uid).then((p) => {
      if (!cancelled) {
        setProgrammeDraft(p?.programmeOfStudy?.trim() ?? "");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  if (!user) {
    return null;
  }

  const displayLabel = user.displayName?.trim() || user.email?.split("@")[0] || "Account";

  async function handleSaveProgramme() {
    if (!user) {
      return;
    }
    setSaving(true);
    try {
      await updateUserProfileProgramme(user.uid, programmeDraft.trim() || null);
      pushToast("Programme of study saved.", "info", "profile-programme");
      setOpen(false);
    } catch {
      pushToast("Could not save programme. Try again.", "error", "profile-programme");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-app-border bg-white text-app-fg shadow-sm transition hover:bg-app-muted"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Account"
      >
        <CircleUser className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        <span className="sr-only">Open account menu</span>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 w-[min(100vw-1.5rem,18rem)] rounded-xl border border-app-border bg-panel p-3 shadow-lg"
          role="menu"
        >
          <div className="border-b border-app-border pb-2">
            <p className="truncate text-sm font-medium text-app-fg">{displayLabel}</p>
            {user.email ? (
              <p className="mt-0.5 truncate text-xs text-app-subtle" title={user.email}>
                {user.email}
              </p>
            ) : null}
          </div>

          <form
            className="mt-3 space-y-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveProgramme();
            }}
          >
            <label htmlFor="tsa-profile-programme" className="text-xs font-medium text-app-subtle">
              Programme of study
            </label>
            <p className="text-[11px] leading-snug text-app-subtle">
              Helps the AI tailor study missions to your field.
            </p>
            <input
              id="tsa-profile-programme"
              type="text"
              value={programmeDraft}
              onChange={(event) => setProgrammeDraft(event.target.value)}
              placeholder="e.g. BSc Computer Science"
              className="w-full rounded-md border border-app-border bg-white px-2.5 py-1.5 text-sm text-app-fg outline-none ring-app-accent focus:ring-2"
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-md bg-app-fg px-2 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save programme"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => void signOutUser()}
            className="mt-3 w-full rounded-md border border-app-border bg-white px-2 py-1.5 text-sm text-app-fg transition hover:bg-app-muted"
            role="menuitem"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
