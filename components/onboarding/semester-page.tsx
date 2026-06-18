"use client";

import { useEffect, useState } from "react";
import { NewSemesterForm } from "@/components/onboarding/new-semester-form";
import { SemesterOnboarding } from "@/components/onboarding/semester-onboarding";
import { getUserProfile } from "@/lib/data/semesters";
import { useAuth } from "@/providers/auth-provider";

export function SemesterPageContent() {
  const { user } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        setOnboardingComplete(null);
        return;
      }
      const profile = await getUserProfile(user.uid);
      if (!cancelled) {
        setOnboardingComplete(profile?.onboardingComplete ?? false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (onboardingComplete === null) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="h-10 animate-pulse rounded-lg bg-app-accent-light" />
        <div className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
          <div className="h-1.5 animate-pulse bg-gradient-to-r from-sky-500 via-violet-500 to-amber-400" />
          <div className="h-48 animate-pulse bg-app-accent-soft/40 p-6" />
        </div>
      </div>
    );
  }

  if (!onboardingComplete) {
    return <SemesterOnboarding />;
  }

  return <NewSemesterForm />;
}
