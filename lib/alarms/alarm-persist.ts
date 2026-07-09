import type { ScheduledAlarm } from "./types";

export const ALARM_DB_NAME = "tsa-alarms-v1";
export const ALARM_STORE = "meta";
export const ALARM_STATE_KEY = "state";

export type PersistedAlarmState = {
  pendingAlarms: ScheduledAlarm[];
  firedAlarmKeys: string[];
  notificationsEnabled: boolean;
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
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ALARM_STORE, "readwrite");
      tx.objectStore(ALARM_STORE).put(state, ALARM_STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal: service worker message sync is still attempted.
  }
}
