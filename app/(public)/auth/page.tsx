"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Sparkles } from "lucide-react";
import { TsaLogoMark } from "@/components/brand/tsa-logo-mark";
import { AuthForm } from "@/components/auth/auth-form";
import { ShimmerAuthPage } from "@/components/ui/shimmer";
import { getUserProfile } from "@/lib/data/semesters";
import { useAuth } from "@/providers/auth-provider";

export default function AuthPage() {
  const { user, isLoading, signInError } = useAuth();
  const router = useRouter();
  const [isRouting, setIsRouting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function routeSignedInUser() {
      if (isLoading || !user) {
        return;
      }
      setIsRouting(true);
      try {
        const profile = await getUserProfile(user.uid);
        if (cancelled) {
          return;
        }
        if (profile?.onboardingComplete) {
          router.replace("/dashboard");
        } else {
          router.replace("/onboarding");
        }
      } finally {
        if (!cancelled) {
          setIsRouting(false);
        }
      }
    }

    void routeSignedInUser();

    return () => {
      cancelled = true;
    };
  }, [isLoading, router, user]);

  if (isLoading || (user && isRouting)) {
    return <ShimmerAuthPage />;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-app-accent-dark via-app-accent to-indigo-600 px-4 py-10">
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-sky-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-violet-400/25 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-48 w-48 -translate-x-1/2 rounded-full bg-amber-300/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 left-1/4 h-40 w-40 rounded-full bg-teal-300/20 blur-3xl" />

      <div className="relative grid w-full max-w-4xl gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="hidden space-y-6 text-white lg:block">
          <div className="inline-flex items-center gap-2.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-blue-100 ring-1 ring-white/20">
            <TsaLogoMark className="h-6 w-6" />
            Built for university life
          </div>
          <h1 className="text-3xl font-semibold leading-tight">
            Your semester, organised with clarity.
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-blue-100">
            Track courses, plan your week, and stay on top of what matters — all in one calm academic workspace.
          </p>
          <ul className="space-y-3 text-sm text-blue-50">
            <li className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-sky-200" />
              Notes, to-dos, and course planning
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-300" />
              AI study nudges when you need direction
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-teal-300" />
              Colour-coded courses and progress
            </li>
          </ul>
        </div>

        <div className="w-full space-y-4">
          <div className="space-y-2 text-center lg:text-left">
            <p className="text-sm font-medium uppercase tracking-wide text-blue-100 lg:text-blue-200">
              Welcome to TSA
            </p>
            <h2 className="text-2xl font-semibold text-white lg:text-app-fg lg:hidden">
              A calmer way to manage your semester.
            </h2>
            <p className="text-sm text-blue-100 lg:hidden">Sign in to continue building your academic system.</p>
          </div>
          <AuthForm initialError={signInError} />
        </div>
      </div>
    </main>
  );
}
