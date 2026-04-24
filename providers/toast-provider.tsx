"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastVariant = "error" | "info";

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
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2 px-4 md:bottom-8 md:right-8">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg ${
              t.variant === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-app-border bg-panel text-app-fg"
            }`}
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
