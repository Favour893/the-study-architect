import {
  type Auth,
  GoogleAuthProvider,
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { firebaseApp, getFirebaseConfigStatus } from "@/lib/firebase/client";

function getClientAuth(): Auth {
  if (!firebaseApp) {
    const { missingConfig } = getFirebaseConfigStatus();
    throw new Error(
      `Firebase is not configured. Missing: ${missingConfig.join(", ") || "unknown values"}.`,
    );
  }

  return getAuth(firebaseApp);
}

export async function signInWithGoogle() {
  const auth = getClientAuth();
  const provider = new GoogleAuthProvider();
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    // Some browsers block popups even after site permission changes.
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : "";

    if (code === "auth/popup-blocked") {
      await signInWithRedirect(auth, provider);
      return;
    }

    throw error;
  }
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(getClientAuth(), email, password);
}

export async function createAccountWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(getClientAuth(), email, password);
}

export async function signOutUser() {
  return signOut(getClientAuth());
}

export { getClientAuth };
