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
    const registration = await navigator.serviceWorker.ready;
    const messaging = getMessaging(firebaseApp);
    return await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("FCM token registration failed:", error);
    }
    return null;
  }
}
