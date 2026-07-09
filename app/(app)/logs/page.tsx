"use client";

import { PersonalLogPlanner } from "@/components/logs/personal-log-planner";
import { ShimmerPage, ShimmerPageHeader, ShimmerPanel } from "@/components/ui/shimmer";
import { useAuth } from "@/providers/auth-provider";

export default function LogsPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <ShimmerPage>
        <ShimmerPageHeader />
        <ShimmerPanel barClassName="from-teal-500 to-cyan-500" bodyClassName="h-48" />
      </ShimmerPage>
    );
  }

  if (!user) {
    return null;
  }

  return <PersonalLogPlanner uid={user.uid} />;
}
