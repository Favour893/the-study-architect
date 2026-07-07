const CACHE_NAME = "tsa-v4";
const PRECACHE_URLS = ["/logo-mark.png", "/logo-512.png", "/offline.html"];
const ALARM_DB_NAME = "tsa-alarms-v1";
const ALARM_STORE = "meta";
const ALARM_STATE_KEY = "state";

/** @type {ScheduledAlarm[]} */
let pendingAlarms = [];
/** @type {Set<string>} */
const firedAlarmKeys = new Set();
/** @type {number | null} */
let alarmTimer = null;

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
 * @returns {Promise<{ pendingAlarms: ScheduledAlarm[]; firedAlarmKeys: string[] }>}
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
          resolve({ pendingAlarms: [], firedAlarmKeys: [] });
          return;
        }
        resolve({
          pendingAlarms: Array.isArray(value.pendingAlarms) ? value.pendingAlarms : [],
          firedAlarmKeys: Array.isArray(value.firedAlarmKeys) ? value.firedAlarmKeys : [],
        });
      };
      get.onerror = () => reject(get.error);
    });
  } catch {
    return { pendingAlarms: [], firedAlarmKeys: [] };
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
      .then(() => {
        scheduleNextAlarm();
      }),
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

/**
 * @param {ScheduledAlarm} alarm
 */
async function fireAlarm(alarm) {
  const key = alarmKey(alarm);
  if (firedAlarmKeys.has(key)) {
    return;
  }
  firedAlarmKeys.add(key);

  await self.registration.showNotification(alarm.title, {
    body: alarm.body,
    tag: key,
    icon: "/logo-mark.png",
    badge: "/logo-mark.png",
    silent: false,
    requireInteraction: true,
    vibrate: [400, 120, 400, 120, 400, 120, 400],
    data: { href: alarm.href || "/dashboard" },
  });

  await persistAlarmState();

  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({ type: "PLAY_ALARM_SOUND" });
    client.postMessage({ type: "ALARM_FIRED", id: alarm.id, fireAt: alarm.fireAt });
  }

  scheduleNextAlarm();
}

function scheduleNextAlarm() {
  if (alarmTimer !== null) {
    clearTimeout(alarmTimer);
    alarmTimer = null;
  }

  const now = Date.now();
  /** @type {{ alarm: ScheduledAlarm; due: number } | null} */
  let next = null;

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
    if (!next || due < next.due) {
      next = { alarm, due };
    }
  }

  if (!next) {
    return;
  }

  const delay = Math.min(next.due - now, 2147483647);
  alarmTimer = setTimeout(() => {
    void fireAlarm(next.alarm);
  }, delay);
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") {
    return;
  }

  if (data.type === "SYNC_ALARMS" && Array.isArray(data.alarms)) {
    pendingAlarms = data.alarms;
    if (Array.isArray(data.firedKeys)) {
      for (const key of data.firedKeys) {
        if (typeof key === "string") {
          firedAlarmKeys.add(key);
        }
      }
    }
    void persistAlarmState().then(() => {
      scheduleNextAlarm();
    });
    return;
  }

  if (data.type === "SHOW_ALARM" && data.alarm) {
    void fireAlarm(data.alarm);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});
