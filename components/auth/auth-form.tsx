"use client";

import { useState } from "react";
import { createAccountWithEmail, signInWithEmail, signInWithGoogle } from "@/lib/firebase/auth";
import { getFirebaseConfigStatus, hasFirebaseConfig } from "@/lib/firebase/client";

type AuthMode = "sign-in" | "create-account";

export function AuthForm() {
  const { missingConfig } = getFirebaseConfigStatus();

  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "create-account") {
        await createAccountWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to continue. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (googleError) {
      setError(googleError instanceof Error ? googleError.message : "Google sign-in failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-app-border bg-panel p-6 shadow-sm">
      {!hasFirebaseConfig ? (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Firebase is not configured yet. Add values in <code>.env.local</code>:{" "}
          {missingConfig.join(", ")}.
        </p>
      ) : null}

      <div className="mb-6 flex rounded-xl bg-app-muted p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("sign-in")}
          className={`flex-1 rounded-lg px-3 py-2 transition ${
            mode === "sign-in" ? "bg-white font-medium text-app-fg shadow-sm" : "text-app-subtle"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("create-account")}
          className={`flex-1 rounded-lg px-3 py-2 transition ${
            mode === "create-account"
              ? "bg-white font-medium text-app-fg shadow-sm"
              : "text-app-subtle"
          }`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm text-app-subtle">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-app-border bg-white px-3 py-2 outline-none ring-app-accent transition focus:ring-2"
            placeholder="you@example.com"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-app-subtle">Password</span>
          <input
            required
            minLength={6}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-app-border bg-white px-3 py-2 outline-none ring-app-accent transition focus:ring-2"
            placeholder="At least 6 characters"
          />
        </label>

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !hasFirebaseConfig}
          className="w-full rounded-lg bg-app-fg px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Please wait..."
            : mode === "create-account"
              ? "Create TSA account"
              : "Sign in"}
        </button>
      </form>

      <div className="my-4 h-px bg-app-border" />

      <button
        type="button"
        onClick={handleGoogle}
        disabled={isSubmitting || !hasFirebaseConfig}
        className="w-full rounded-lg border border-app-border bg-white px-3 py-2 text-sm font-medium text-app-fg transition hover:bg-app-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        Continue with Google
      </button>
    </div>
  );
}
