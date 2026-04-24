"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { getUserProfile } from "@/lib/data/semesters";

type AuthGateProps = {
  children: React.ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const { user, isLoading } = useAuth();
  const [isRouting, setIsRouting] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function guardRoutes() {
      if (isLoading) {
        return;
      }

      if (!user) {
        router.replace("/auth");
        return;
      }

      const profile = await getUserProfile(user.uid);
      const onboardingComplete = profile?.onboardingComplete ?? false;

      if (!isMounted) {
        return;
      }

      if (!onboardingComplete && pathname !== "/onboarding") {
        router.replace("/onboarding");
        return;
      }

      setIsRouting(false);
    }

    void guardRoutes();

    return () => {
      isMounted = false;
    };
  }, [isLoading, pathname, router, user]);

  if (isLoading || isRouting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-app-border border-t-app-fg" />
      </div>
    );
  }

  return <>{children}</>;
}
