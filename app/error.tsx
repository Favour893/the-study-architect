"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEventId(Sentry.captureException(error));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [error]);

  return (
    <main className="mx-auto mt-10 w-full max-w-lg rounded-2xl border border-app-border bg-panel p-6 shadow-sm">
      <p className="text-sm uppercase tracking-wide text-app-subtle">System alert</p>
      <h1 className="mt-2 text-xl font-semibold text-app-fg">The Architect is fixing a structural issue.</h1>
      <p className="mt-2 text-sm text-app-subtle">Please refresh the page.</p>
      {eventId ? (
        <p className="mt-2 text-xs text-app-subtle">
          Trace ID: <code>{eventId}</code>
        </p>
      ) : null}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg border border-app-border bg-white px-4 py-2 text-sm font-medium text-app-fg hover:bg-app-muted"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={() => {
            if (eventId) {
              Sentry.showReportDialog({ eventId });
            }
          }}
          className="rounded-lg border border-app-border bg-white px-4 py-2 text-sm font-medium text-app-fg hover:bg-app-muted"
        >
          Report Issue
        </button>
      </div>
    </main>
  );
}
