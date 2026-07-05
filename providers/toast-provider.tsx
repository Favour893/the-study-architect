"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastVariant = "error" | "info" | "success";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  pushToast: (
    message: string,
    variant?: ToastVariant,
    dedupeKey?: string,
    dedupeMs?: number,
  ) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DEDUPE_MS = 90_000;

const TOAST_STYLES: Record<ToastVariant, string> = {
  error:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-200",
  info: "border-app-border bg-panel text-app-fg shadow-md ring-1 ring-app-border/60",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dedupeRef = useRef<Map<string, number>>(new Map());

  const pushToast = useCallback(
    (
      message: string,
      variant: ToastVariant = "info",
      dedupeKey?: string,
      dedupeMs: number = DEFAULT_DEDUPE_MS,
    ) => {
      if (dedupeKey) {
        const now = Date.now();
        const last = dedupeRef.current.get(dedupeKey) ?? 0;
        if (now - last < dedupeMs) {
          return;
        }
        dedupeRef.current.set(dedupeKey, now);
      }

      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, variant }]);

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5500);
    },
    [],
  );

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-end gap-2 px-4 md:inset-x-auto md:bottom-8 md:right-8 md:max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${TOAST_STYLES[t.variant]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
