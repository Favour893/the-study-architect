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

export type DeliverDueResult = {
  ok: boolean;
  sent?: number;
  due?: number;
  waiting?: number;
  skipped?: number;
  errors?: string[];
  error?: string;
};

/** Sends real FCM system notifications for this user’s due alarm jobs. */
export async function requestDeliverDueAlerts(idToken: string): Promise<DeliverDueResult> {
  try {
    const response = await fetch("/api/alarms/dispatch-mine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const data = (await response.json()) as DeliverDueResult;
    if (!response.ok) {
      return { ok: false, error: data.error || `http_${response.status}` };
    }
    return {
      ok: Boolean(data.ok !== false),
      sent: data.sent,
      due: data.due,
      waiting: data.waiting,
      skipped: data.skipped,
      errors: data.errors,
      error: data.error,
    };
  } catch {
    return { ok: false, error: "network_failed" };
  }
}

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
