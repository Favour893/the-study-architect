const CACHE_NAME = "tsa-v8";
const PRECACHE_URLS = ["/logo-mark.png", "/logo-512.png", "/offline.html"];
const ALARM_DB_NAME = "tsa-alarms-v1";
const ALARM_STORE = "meta";
const ALARM_STATE_KEY = "state";
const ALARM_CHECK_INTERVAL_MS = 30 * 1000;
const ALARM_NEAR_WINDOW_MS = 15 * 60 * 1000;
const ALARM_EXACT_WINDOW_MS = 10 * 1000;

/** @type {ScheduledAlarm[]} */
let pendingAlarms = [];
/** @type {Set<string>} */
const firedAlarmKeys = new Set();
/** @type {Set<string>} */
const ringingAlarmKeys = new Set();
/** @type {number | null} */
let alarmTimer = null;
/** @type {number[]} */
let pulseTimerIds = [];
let notificationsEnabled = true;

/**
 * @typedef {{ id: string; fireAt: string; title: string; body: string; href?: string }} ScheduledAlarm
 */

function openAlarmDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ALARM_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(ALARM_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * @returns {Promise<{ pendingAlarms: ScheduledAlarm[]; firedAlarmKeys: string[]; notificationsEnabled: boolean }>}
 */
async function readPersistedAlarmState() {
  try {
    const db = await openAlarmDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(ALARM_STORE, "readonly");
      const get = tx.objectStore(ALARM_STORE).get(ALARM_STATE_KEY);
      get.onsuccess = () => {
        const value = get.result;
        if (!value || typeof value !== "object") {
          resolve({ pendingAlarms: [], firedAlarmKeys: [], notificationsEnabled: true });
          return;
        }
        resolve({
          pendingAlarms: Array.isArray(value.pendingAlarms) ? value.pendingAlarms : [],
          firedAlarmKeys: Array.isArray(value.firedAlarmKeys) ? value.firedAlarmKeys : [],
          notificationsEnabled: value.notificationsEnabled !== false,
        });
      };
      get.onerror = () => reject(get.error);
    });
  } catch {
    return { pendingAlarms: [], firedAlarmKeys: [], notificationsEnabled: true };
  }
}

async function persistAlarmState() {
  try {
    const db = await openAlarmDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ALARM_STORE, "readwrite");
      tx.objectStore(ALARM_STORE).put(
        {
          pendingAlarms,
          firedAlarmKeys: [...firedAlarmKeys],
          notificationsEnabled,
        },
        ALARM_STATE_KEY,
      );
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal: in-memory scheduling still works until the worker restarts.
  }
}

async function hydrateAlarmState() {
  const saved = await readPersistedAlarmState();
  pendingAlarms = saved.pendingAlarms;
  notificationsEnabled = saved.notificationsEnabled;
  firedAlarmKeys.clear();
  for (const key of saved.firedAlarmKeys) {
    firedAlarmKeys.add(key);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => hydrateAlarmState())
      .then(() => scheduleNextAlarm()),
  );
});

function isStaticAsset(pathname) {
  return PRECACHE_URLS.includes(pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match("/offline.html").then((cached) => cached ?? Response.error())),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

function alarmKey(alarm) {
  return `${alarm.id}:${alarm.fireAt}`;
}

function notificationData(alarm, key) {
  return {
    href: alarm.href || "/dashboard",
    alarmId: alarm.id,
    fireAt: alarm.fireAt,
    alarmKey: key,
  };
}

function notificationOptions(alarm, key, includeVibrate) {
  const options = {
    body: `${alarm.body}\n\nTap or swipe away to turn off.`,
    tag: key,
    icon: "/logo-mark.png",
    badge: "/logo-mark.png",
    silent: false,
    requireInteraction: true,
    data: notificationData(alarm, key),
  };
  if (includeVibrate) {
    options.vibrate = [500, 150, 500, 150, 500];
  }
  return options;
}

async function showAlarmNotification(alarm, key) {
  const options = notificationOptions(alarm, key, true);
  try {
    await self.registration.showNotification(alarm.title, options);
    return true;
  } catch {
    try {
      await self.registration.showNotification(alarm.title, notificationOptions(alarm, key, false));
      return true;
    } catch {
      try {
        await self.registration.showNotification(alarm.title, {
          body: alarm.body,
          tag: key,
          icon: "/logo-mark.png",
          silent: false,
          data: notificationData(alarm, key),
        });
        return true;
      } catch {
        return false;
      }
    }
  }
}

function cancelAlarmPulseTimers() {
  for (const timerId of pulseTimerIds) {
    clearTimeout(timerId);
  }
  pulseTimerIds = [];
}

function pulseAlarmSoundToClients() {
  cancelAlarmPulseTimers();
  for (let pulse = 0; pulse < 5; pulse += 1) {
    const timerId = setTimeout(() => {
      void self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((openClients) => {
        for (const client of openClients) {
          client.postMessage({ type: "PLAY_ALARM_SOUND" });
        }
      });
    }, pulse * 4000);
    pulseTimerIds.push(timerId);
  }
}

function notifyClientsToStopAlarm(data) {
  void self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((openClients) => {
    for (const client of openClients) {
      client.postMessage({ type: "STOP_ALARM_SOUND" });
      if (data?.alarmId && data?.fireAt) {
        client.postMessage({
          type: "ALARM_DISMISSED",
          id: data.alarmId,
          fireAt: data.fireAt,
        });
      }
    }
  });
}

async function closeAllAlarmNotifications() {
  const notifications = await self.registration.getNotifications();
  for (const notification of notifications) {
    notification.close();
  }
}

async function closeAlarmNotifications(data) {
  const tag = data?.alarmKey || (data?.alarmId && data?.fireAt ? `${data.alarmId}:${data.fireAt}` : null);
  if (tag) {
    const tagged = await self.registration.getNotifications({ tag });
    for (const notification of tagged) {
      notification.close();
    }
  }
  await closeAllAlarmNotifications();
}

async function dismissAlarmNotification(data) {
  const key =
    data?.alarmKey || (data?.alarmId && data?.fireAt ? `${data.alarmId}:${data.fireAt}` : null);
  if (key) {
    ringingAlarmKeys.delete(key);
  }

  cancelAlarmPulseTimers();
  notifyClientsToStopAlarm(data);
  await closeAlarmNotifications(data);

  if (data?.alarmId && data?.fireAt) {
    firedAlarmKeys.add(`${data.alarmId}:${data.fireAt}`);
    await persistAlarmState();
    scheduleNextAlarm();
  }
}

/**
 * @param {ScheduledAlarm} alarm
 * @returns {Promise<boolean>}
 */
async function fireAlarm(alarm) {
  if (!notificationsEnabled) {
    return false;
  }

  const key = alarmKey(alarm);
  if (firedAlarmKeys.has(key)) {
    return true;
  }

  const shown = await showAlarmNotification(alarm, key);
  if (!shown) {
    scheduleNextAlarm();
    return false;
  }

  firedAlarmKeys.add(key);
  ringingAlarmKeys.add(key);
  await persistAlarmState();

  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({ type: "ALARM_FIRED", id: alarm.id, fireAt: alarm.fireAt });
    client.postMessage({ type: "PLAY_ALARM_SOUND" });
  }
  pulseAlarmSoundToClients();

  scheduleNextAlarm();
  return true;
}

function computeAlarmDelay(timeUntilMs) {
  if (timeUntilMs <= ALARM_EXACT_WINDOW_MS) {
    return Math.max(timeUntilMs, 0);
  }
  if (timeUntilMs <= ALARM_NEAR_WINDOW_MS) {
    return Math.min(timeUntilMs, ALARM_CHECK_INTERVAL_MS);
  }
  return Math.min(timeUntilMs, 2 * ALARM_CHECK_INTERVAL_MS);
}

async function wakeAlarmScheduler() {
  await hydrateAlarmState();
  await scheduleNextAlarm();
}

self.addEventListener("sync", (event) => {
  if (event.tag === "alarm-sync") {
    event.waitUntil(wakeAlarmScheduler());
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "alarm-check") {
    event.waitUntil(wakeAlarmScheduler());
  }
});

async function scheduleNextAlarm() {
  if (alarmTimer !== null) {
    clearTimeout(alarmTimer);
    alarmTimer = null;
  }

  await hydrateAlarmState();

  if (!notificationsEnabled) {
    return;
  }

  const now = Date.now();
  /** @type {number | null} */
  let earliestFutureDue = null;

  for (const alarm of pendingAlarms) {
    const key = alarmKey(alarm);
    if (firedAlarmKeys.has(key)) {
      continue;
    }
    const due = new Date(alarm.fireAt).getTime();
    if (Number.isNaN(due)) {
      continue;
    }
    if (due <= now) {
      void fireAlarm(alarm);
      continue;
    }
    if (earliestFutureDue === null || due < earliestFutureDue) {
      earliestFutureDue = due;
    }
  }

  if (earliestFutureDue === null) {
    return;
  }

  const delay = computeAlarmDelay(earliestFutureDue - now);
  alarmTimer = setTimeout(() => {
    void scheduleNextAlarm();
  }, delay);
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") {
    return;
  }

  if (data.type === "SYNC_ALARMS" && Array.isArray(data.alarms)) {
    pendingAlarms = data.alarms;
    notificationsEnabled = data.notificationsEnabled !== false;
    if (Array.isArray(data.firedKeys)) {
      for (const key of data.firedKeys) {
        if (typeof key === "string") {
          firedAlarmKeys.add(key);
        }
      }
    }
    const replyPort = event.ports?.[0];
    const finalize = persistAlarmState().then(() => scheduleNextAlarm()).then(() => {
      if (replyPort) {
        replyPort.postMessage({ ok: true });
      }
    });
    if (typeof event.waitUntil === "function") {
      event.waitUntil(finalize);
    } else {
      void finalize;
    }
    return;
  }

  if (data.type === "GET_FIRED_KEYS") {
    const replyPort = event.ports?.[0];
    if (replyPort) {
      replyPort.postMessage({ firedKeys: [...firedAlarmKeys] });
    }
    return;
  }

  if (data.type === "SHOW_ALARM" && data.alarm) {
    const replyPort = event.ports?.[0];
    void fireAlarm(data.alarm).then((ok) => {
      if (replyPort) {
        replyPort.postMessage({ ok });
      }
    });
  }

  if (data.type === "DISMISS_ALARM" && data.alarmId && data.fireAt) {
    void dismissAlarmNotification({
      alarmId: data.alarmId,
      fireAt: data.fireAt,
      alarmKey: `${data.alarmId}:${data.fireAt}`,
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  event.notification.close();
  event.waitUntil(dismissAlarmNotification(data));
});

self.addEventListener("notificationclose", (event) => {
  const data = event.notification.data || {};
  if (!data.alarmId || !data.fireAt) {
    return;
  }
  event.waitUntil(dismissAlarmNotification(data));
});
