import { initializeApp, getApp, getApps } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const missingConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const hasFirebaseConfig = missingConfig.length === 0;

if (typeof window !== "undefined" && !hasFirebaseConfig) {
  // Useful warning while bootstrapping local env variables.
  console.warn(
    `Firebase configuration is incomplete. Missing: ${missingConfig.join(", ")}`,
  );
}

export function getFirebaseConfigStatus() {
  return {
    hasFirebaseConfig,
    missingConfig,
  };
}

export const firebaseApp = hasFirebaseConfig
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

let emulatorConnectAttempted = false;

/**
 * Routes Auth + Firestore to local emulators when NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true (browser only).
 */
function connectLocalEmulatorsIfConfigured() {
  if (typeof window === "undefined" || !firebaseApp || emulatorConnectAttempted) {
    return;
  }
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== "true") {
    return;
  }
  emulatorConnectAttempted = true;
  const authHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
  const fsHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ?? "127.0.0.1";
  const fsPort = Number(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT ?? "8080");

  const auth = getAuth(firebaseApp);
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
  const db = getFirestore(firebaseApp);
  connectFirestoreEmulator(db, fsHost, fsPort);
}

connectLocalEmulatorsIfConfigured();
