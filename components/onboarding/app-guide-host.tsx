"use client";

import { useEffect, useState } from "react";
import { FirstTimeGuide } from "@/components/onboarding/first-time-guide";
import { getUserProfile, markAppGuideSeen } from "@/lib/data/semesters";
import { useAuth } from "@/providers/auth-provider";

export function AppGuideHost() {
  const { user } = useAuth();
  const [showAppGuide, setShowAppGuide] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadGuideState() {
      if (!user) {
        return;
      }
      const profile = await getUserProfile(user.uid);
      if (!cancelled && profile?.onboardingComplete && profile.hasSeenAppGuide !== true) {
        setShowAppGuide(true);
      }
    }

    void loadGuideState();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    function openGuide() {
      setShowAppGuide(true);
    }

    window.addEventListener("tsa:open-app-guide", openGuide);
    return () => window.removeEventListener("tsa:open-app-guide", openGuide);
  }, []);

  async function completeAppGuide() {
    setShowAppGuide(false);
    if (user) {
      await markAppGuideSeen(user.uid);
    }
  }

  if (!showAppGuide) {
    return null;
  }

  return <FirstTimeGuide onComplete={() => void completeAppGuide()} />;
}
