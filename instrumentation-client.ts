import * as Sentry from "@sentry/nextjs";

function replaySampleRateForSession() {
  if (typeof window === "undefined") {
    return 0;
  }
  const key = "tsa.sentry.session-count";
  const prior = Number(window.sessionStorage.getItem(key) ?? "0");
  const next = Number.isFinite(prior) ? prior + 1 : 1;
  window.sessionStorage.setItem(key, String(next));
  // Capture replay for first 100 local sessions, then sample lower.
  return next <= 100 ? 1.0 : 0.1;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: replaySampleRateForSession(),
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});
