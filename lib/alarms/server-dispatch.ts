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

export type TestPushResult = {
  ok: boolean;
  error?: string;
  hint?: string;
};

/** Sends a real FCM push so closed-app delivery can be verified. */
export async function requestTestPush(idToken: string): Promise<TestPushResult> {
  try {
    const response = await fetch("/api/alarms/test-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const data = (await response.json()) as TestPushResult;
    if (!response.ok) {
      return {
        ok: false,
        error: data.error || `http_${response.status}`,
        hint: data.hint,
      };
    }
    return { ok: Boolean(data.ok), error: data.error, hint: data.hint };
  } catch {
    return { ok: false, error: "network_failed" };
  }
}
