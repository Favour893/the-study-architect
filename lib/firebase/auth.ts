import {
  type Auth,
  type UserCredential,
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { readOAuthUrlError } from "@/lib/firebase/auth-errors";
import { firebaseApp, getFirebaseConfigStatus } from "@/lib/firebase/client";

const GOOGLE_SIGN_IN_PENDING_KEY = "tsa.googleSignInPending";

let googleRedirectResultPromise: Promise<UserCredential | null> | null = null;

function getClientAuth(): Auth {
  if (!firebaseApp) {
    const { missingConfig } = getFirebaseConfigStatus();
    throw new Error(
      `Firebase is not configured. Missing: ${missingConfig.join(", ") || "unknown values"}.`,
    );
  }

  return getAuth(firebaseApp);
}

function getAuthErrorCode(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : "";
}

const googleRedirectFallbackCodes = new Set([
  "auth/popup-blocked",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
]);

function markGoogleRedirectPending() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(GOOGLE_SIGN_IN_PENDING_KEY, "1");
  }
}

function clearGoogleRedirectPending() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(GOOGLE_SIGN_IN_PENDING_KEY);
  }
}

function wasGoogleRedirectPending() {
  if (typeof window === "undefined") {
    return false;
  }
  return sessionStorage.getItem(GOOGLE_SIGN_IN_PENDING_KEY) === "1";
}

function incompleteGoogleRedirectMessage() {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3001";
  return `Google sign-in did not complete. In Google Cloud Console → APIs & Services → Credentials, open your Web OAuth client and add "${origin}" under Authorized JavaScript origins.`;
}

export async function completeGoogleRedirectSignIn() {
  const urlError = readOAuthUrlError();
  if (urlError) {
    clearGoogleRedirectPending();
    throw new Error(urlError);
  }

  if (!googleRedirectResultPromise) {
    googleRedirectResultPromise = getRedirectResult(getClientAuth());
  }

  const result = await googleRedirectResultPromise;
  const pending = wasGoogleRedirectPending();
  clearGoogleRedirectPending();

  if (pending && !result?.user && !getClientAuth().currentUser) {
    throw new Error(incompleteGoogleRedirectMessage());
  }

  return result;
}

export async function signInWithGoogle() {
  const auth = getClientAuth();
  const provider = new GoogleAuthProvider();

  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (googleRedirectFallbackCodes.has(getAuthErrorCode(error))) {
      markGoogleRedirectPending();
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
