"use client";

import { signOutUser } from "@/lib/firebase/auth";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { CircleUser, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function UserProfileMenu() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
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

  if (!user) {
    return null;
  }

  const displayLabel = user.displayName?.trim() || user.email?.split("@")[0] || "Account";

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-app-border bg-panel text-app-fg shadow-sm transition hover:bg-app-muted"
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

          <button
            type="button"
            onClick={toggleTheme}
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-md border border-app-border bg-app-accent-soft px-2.5 py-2 text-sm text-app-fg transition hover:bg-app-muted"
            role="menuitem"
          >
            <span className="flex items-center gap-2">
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-app-warning" aria-hidden />
              ) : (
                <Moon className="h-4 w-4 text-app-accent" aria-hidden />
              )}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
            <span
              className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                theme === "dark" ? "bg-app-accent" : "bg-app-border"
              }`}
              aria-hidden
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                  theme === "dark" ? "left-4" : "left-0.5"
                }`}
              />
            </span>
          </button>

          <button
            type="button"
            onClick={() => void signOutUser()}
            className="mt-3 w-full rounded-md border border-app-border bg-panel px-2 py-1.5 text-sm text-app-fg transition hover:bg-app-muted"
            role="menuitem"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
