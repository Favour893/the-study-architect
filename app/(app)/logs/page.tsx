"use client";

import { PersonalLogPlanner } from "@/components/logs/personal-log-planner";
import { PersonalTimetableSection } from "@/components/logs/personal-timetable-section";
import { useAuth } from "@/providers/auth-provider";

export default function PersonalLogsPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-app-accent-soft/40" />
        <div className="h-48 animate-pulse rounded-2xl bg-app-accent-soft/30" />
      </div>
    );
  }

  if (!user) {
    return (
      <p className="rounded-xl border border-app-border bg-panel px-4 py-6 text-sm text-app-subtle">
        Sign in to manage your personal logs.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
        <div className="h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500" />
        <div className="p-5">
          <h2 className="text-lg font-semibold text-app-fg">Personal Logs</h2>
          <p className="mt-1 text-sm text-app-subtle">
            Your daily to-dos with reminders, personal notes, and your week-long personal timetable.
          </p>
        </div>
      </header>

      <PersonalLogPlanner uid={user.uid} />
      <PersonalTimetableSection />
    </div>
  );
}
