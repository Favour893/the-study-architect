import type { RecentAlert } from "./alert-deep-link";
import type { ScheduledAlarm } from "./types";

export const ALARM_DB_NAME = "tsa-alarms-v1";
export const ALARM_STORE = "meta";
export const ALARM_STATE_KEY = "state";

export type PersistedAlarmState = {
  pendingAlarms: ScheduledAlarm[];
  firedAlarmKeys: string[];
  notificationsEnabled: boolean;
  lastFiredAlert?: RecentAlert | null;
};

function openAlarmDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ALARM_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(ALARM_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function persistAlarmSchedule(state: PersistedAlarmState): Promise<void> {
  try {
    const db = await openAlarmDb();
    const existing = await new Promise<PersistedAlarmState | null>((resolve, reject) => {
      const tx = db.transaction(ALARM_STORE, "readonly");
      const get = tx.objectStore(ALARM_STORE).get(ALARM_STATE_KEY);
      get.onsuccess = () => {
        const value = get.result;
        resolve(value && typeof value === "object" ? (value as PersistedAlarmState) : null);
      };
      get.onerror = () => reject(get.error);
    });
    const nextState: PersistedAlarmState = {
      ...state,
      lastFiredAlert:
        state.lastFiredAlert !== undefined
          ? state.lastFiredAlert
          : (existing?.lastFiredAlert ?? null),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ALARM_STORE, "readwrite");
      tx.objectStore(ALARM_STORE).put(nextState, ALARM_STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal: service worker message sync is still attempted.
  }
}

export async function readLastFiredAlert(): Promise<RecentAlert | null> {
  try {
    const db = await openAlarmDb();
    const value = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(ALARM_STORE, "readonly");
      const get = tx.objectStore(ALARM_STORE).get(ALARM_STATE_KEY);
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    });
    if (!value || typeof value !== "object") {
      return null;
    }
    const last = (value as PersistedAlarmState).lastFiredAlert;
    if (
      !last ||
      typeof last.alarmId !== "string" ||
      typeof last.fireAt !== "string" ||
      typeof last.title !== "string" ||
      typeof last.body !== "string" ||
      typeof last.href !== "string"
    ) {
      return null;
    }
    return {
      alarmId: last.alarmId,
      fireAt: last.fireAt,
      title: last.title,
      body: last.body,
      href: last.href || "/dashboard",
      seenAt: typeof last.seenAt === "number" ? last.seenAt : Date.now(),
    };
  } catch {
    return null;
  }
}
