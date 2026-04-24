import {
  type Auth,
  GoogleAuthProvider,
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
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
  return signInWithPopup(getClientAuth(), new GoogleAuthProvider());
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
