"use client";

import { signOutUser } from "@/lib/firebase/auth";
import { BookOpen, CalendarDays, Clock3, Gauge, Sigma } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useSemester } from "@/providers/semester-provider";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarNav, type NavItem } from "@/components/layout/sidebar-nav";

type AppShellProps = {
  children: React.ReactNode;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Pulse", icon: Gauge },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/timetable", label: "Timetable", icon: Clock3 },
  { href: "/calculator", label: "Grade Calculator", icon: Sigma },
  { href: "/onboarding", label: "Semester", icon: CalendarDays },
];

export function AppShell({ children }: AppShellProps) {
  const { user } = useAuth();
  const { semesters, activeSemesterId, isLoading: semesterLoading, setActiveSemester } = useSemester();

  return (
    <div className="h-dvh bg-app">
      <div className="flex h-full w-full">
        <SidebarNav items={navItems} />
        <main className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col">
          <header className="z-10 flex h-14 min-w-0 shrink-0 items-center justify-between gap-2 border-b border-app-border bg-app/80 px-3 backdrop-blur md:px-6">
            <div className="min-w-0 pr-2">
              <p className="text-xs text-app-subtle">The Study Architect</p>
              <h1 className="truncate text-sm font-medium text-app-fg">Keep it simple. Keep it moving.</h1>
            </div>
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              {semesters.length > 0 ? (
                <label className="flex min-w-0 max-w-[44vw] items-center gap-1.5 sm:max-w-[220px]">
                  <span className="hidden text-xs text-app-subtle sm:inline">Semester</span>
                  <select
                    value={activeSemesterId ?? ""}
                    disabled={semesterLoading}
                    onChange={(event) => void setActiveSemester(event.target.value)}
                    className="min-w-0 flex-1 truncate rounded-md border border-app-border bg-white px-2 py-1.5 text-xs text-app-fg outline-none ring-app-accent focus:ring-2 sm:text-sm"
                  >
                    {semesters.map((sem) => (
                      <option key={sem.id} value={sem.id}>
                        {sem.name}
                        {sem.isArchived ? " (archived)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <p className="hidden truncate text-xs text-app-subtle md:block">{user?.email}</p>
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="rounded-md border border-app-border bg-white px-2.5 py-1 text-xs text-app-fg hover:bg-app-muted"
              >
                Sign out
              </button>
            </div>
          </header>
          <section className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto px-3 py-4 pb-24 md:px-6 md:pb-4">
            {children}
          </section>
        </main>
      </div>
      <BottomNav items={navItems} />
    </div>
  );
}
