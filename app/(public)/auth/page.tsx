"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Sparkles } from "lucide-react";
import { TsaLogoMark } from "@/components/brand/tsa-logo-mark";
import { AuthForm } from "@/components/auth/auth-form";
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