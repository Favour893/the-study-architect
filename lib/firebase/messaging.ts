"use client";

import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { firebaseApp, hasFirebaseConfig } from "./client";

export function hasFcmClientConfig() {
  return hasFirebaseConfig && Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim());
}

export async function ensureFcmToken(): Promise<string | null> {
  if (!firebaseApp || !hasFcmClientConfig() || typeof window === "undefined") {
    return null;
  }
  if (!("serviceWorker" in navigator)) {
    return null;
  }
  if (!(await isSupported())) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (error) {
    console.warn("FCM token registration failed:", error);
    return null;
  }
}
