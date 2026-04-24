"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { useAuth } from "@/providers/auth-provider";

export default function AuthPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [isLoading, router, user]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4">
        <div className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-wide text-app-subtle">Welcome to TSA</p>
          <h1 className="text-2xl font-semibold text-app-fg">A calmer way to manage your semester.</h1>
          <p className="text-sm text-app-subtle">Sign in to continue building your academic system.</p>
        </div>
        <AuthForm />
      </div>
    </main>
  );
}
