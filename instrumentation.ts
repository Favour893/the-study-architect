export async function register() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  await import("./instrumentation.sentry");
}
