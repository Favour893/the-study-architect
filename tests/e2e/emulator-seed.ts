import { config as loadEnv } from "dotenv";
import { resolve } from "path";
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { connectFirestoreEmulator, doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

/**
 * Loads `.env.local` so CI/local runs share the same Firebase web config as the app.
 */
function loadDotenv() {
  loadEnv({ path: resolve(process.cwd(), "tests/e2e/env.emulator") });
  loadEnv({ path: resolve(process.cwd(), ".env.local") });
}

function firebaseWebConfig() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-tsa";
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "demo-api-key",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? `${projectId}.appspot.com`,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "123456789012",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:123456789012:web:e2e",
  };
}

const SEMESTER_ID = "e2e-semester-1";

let singletonApp: FirebaseApp | null = null;

function getSeedApp(): FirebaseApp {
  if (!singletonApp) {
    singletonApp = initializeApp(firebaseWebConfig());
  }
  return singletonApp;
}

/**
 * Creates the E2E user (Auth emulator) and seeds profile + semester (Firestore emulator).
 * Safe to call repeatedly (merge writes).
 */
export async function seedFirebaseEmulatorsForE2E() {
  loadDotenv();

  const email = process.env.TSA_E2E_EMAIL ?? "e2e@demo-tsa.local";
  const password = process.env.TSA_E2E_PASSWORD ?? "e2e-password-123456";

  const app = getSeedApp();
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });

  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080);

  let uid: string;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: string }).code)
        : "";
    if (code === "auth/email-already-in-use") {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      uid = cred.user.uid;
    } else {
      throw error;
    }
  }

  await setDoc(
    doc(db, `users/${uid}/profile/main`),
    {
      uid,
      email,
      displayName: "E2E User",
      gradeMode: "GPA",
      onboardingComplete: true,
      activeSemesterId: SEMESTER_ID,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );

  await setDoc(
    doc(db, `users/${uid}/semesters/${SEMESTER_ID}`),
    {
      id: SEMESTER_ID,
      name: "E2E Semester",
      startDate: "2026-01-15",
      endDate: "2026-12-15",
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
