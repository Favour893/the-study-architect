export async function requestServerAlarmDispatch(idToken: string) {
  try {
    await fetch("/api/alarms/dispatch-mine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      keepalive: true,
    });
  } catch {
    // Best-effort: local alarms still run while the app is open.
  }
}
