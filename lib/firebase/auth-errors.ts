export function humanizeAuthError(error: unknown) {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";

  if (code === "auth/invalid-credential") {
    return "Invalid credential. Check Firebase web config values and Google provider setup for this deployment.";
  }
  if (code === "auth/unauthorized-domain") {
    return "This domain is not authorized in Firebase Auth. Add localhost (or your site domain) under Authentication → Settings → Authorized domains.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Google sign-in is not enabled for this Firebase project. Enable the Google provider under Authentication → Sign-in method.";
  }
  if (code === "auth/popup-closed-by-user") {
    return "Google sign-in was cancelled before completion. Try again.";
  }
  if (code === "auth/popup-blocked") {
    return "Your browser blocked the Google sign-in popup. Allow popups for localhost, or try again to use redirect sign-in.";
  }
  if (code === "auth/network-request-failed") {
    return "Network request failed. Check your internet connection and try again.";
  }
  if (code === "auth/account-exists-with-different-credential") {
    return "An account already exists with this email using a different sign-in method. Try email/password instead.";
  }

  return error instanceof Error ? error.message : "Unable to continue. Try again.";
}

export function readOAuthUrlError(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : "";
  const params = new URLSearchParams(hash || window.location.search);
  const error = params.get("error");
  if (!error) {
    return null;
  }

  const description = params.get("error_description")?.replace(/\+/g, " ");
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return description ?? error;
}
