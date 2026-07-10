export type AlertKind = "todo" | "exam" | "class";

export type AlertDeepLink = {
  alert: AlertKind;
  id: string;
};

export type RecentAlert = {
  alarmId: string;
  fireAt: string;
  title: string;
  body: string;
  href: string;
  seenAt: number;
};

export const RECENT_ALERT_KEY = "tsa.recent-alert";
export const RECENT_ALERT_SHOWN_KEY = "tsa.recent-alert.shown";
export const RECENT_ALERT_EVENT = "tsa:recent-alert";

export function buildTodoAlertHref(todoId: string) {
  return `/logs?alert=todo&id=${encodeURIComponent(todoId)}`;
}

export function buildExamAlertHref(rowId: string) {
  return `/timetable?alert=exam&id=${encodeURIComponent(rowId)}`;
}

export function buildClassAlertHref(entryKey: string) {
  return `/timetable?alert=class&id=${encodeURIComponent(entryKey)}`;
}

export function parseAlertDeepLink(search: string | URLSearchParams): AlertDeepLink | null {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const alert = params.get("alert");
  const id = params.get("id")?.trim() ?? "";
  if (!id) {
    return null;
  }
  if (alert === "todo" || alert === "exam" || alert === "class") {
    return { alert, id };
  }
  return null;
}

export function recentAlertKey(alarmId: string, fireAt: string) {
  return `${alarmId}:${fireAt}`;
}

export function saveRecentAlert(alert: Omit<RecentAlert, "seenAt"> & { seenAt?: number }) {
  if (typeof window === "undefined") {
    return;
  }
  const record: RecentAlert = {
    ...alert,
    seenAt: alert.seenAt ?? Date.now(),
  };
  window.localStorage.setItem(RECENT_ALERT_KEY, JSON.stringify(record));
  window.dispatchEvent(new CustomEvent(RECENT_ALERT_EVENT, { detail: record }));
}

export function loadRecentAlert(): RecentAlert | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(RECENT_ALERT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<RecentAlert>;
    if (
      typeof parsed.alarmId !== "string" ||
      typeof parsed.fireAt !== "string" ||
      typeof parsed.title !== "string" ||
      typeof parsed.body !== "string" ||
      typeof parsed.href !== "string"
    ) {
      return null;
    }
    return {
      alarmId: parsed.alarmId,
      fireAt: parsed.fireAt,
      title: parsed.title,
      body: parsed.body,
      href: parsed.href || "/dashboard",
      seenAt: typeof parsed.seenAt === "number" ? parsed.seenAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function clearRecentAlert() {
  if (typeof window === "undefined") {
    return;
  }
  const current = loadRecentAlert();
  if (current) {
    window.localStorage.setItem(
      RECENT_ALERT_SHOWN_KEY,
      recentAlertKey(current.alarmId, current.fireAt),
    );
  }
  window.localStorage.removeItem(RECENT_ALERT_KEY);
  window.dispatchEvent(new CustomEvent(RECENT_ALERT_EVENT, { detail: null }));
}

export function wasRecentAlertShown(alarmId: string, fireAt: string) {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(RECENT_ALERT_SHOWN_KEY) === recentAlertKey(alarmId, fireAt);
}

export function markRecentAlertShown(alarmId: string, fireAt: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(RECENT_ALERT_SHOWN_KEY, recentAlertKey(alarmId, fireAt));
}
