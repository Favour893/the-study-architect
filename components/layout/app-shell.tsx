"use client";

import { signOutUser } from "@/lib/firebase/auth";
import { useAuth } from "@/providers/auth-provider";
import { useSemester } from "@/providers/semester-provider";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarNav, type NavItem } from "@/components/layout/sidebar-nav";

type AppShellProps = {
  children: React.ReactNode;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Pulse" },
  { href: "/courses", label: "Courses" },
  { href: "/timetable", label: "Timetable" },
  { href: "/calculator", label: "Grade Calculator" },
  { href: "/onboarding", label: "Semester" },
];

export function AppShell({ children }: AppShellProps) {
  const { user } = useAuth();
  const { semesters, activeSemesterId, isLoading: semesterLoading, setActiveSemester } = useSemester();

  return (
    <div className="min-h-screen bg-app">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl">
        <SidebarNav items={navItems} />
        <main className="flex w-full flex-1 flex-col pb-20 md:pb-0">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-app-border bg-app/80 px-4 backdrop-blur md:px-8">
            <div>
              <p className="text-sm text-app-subtle">The Study Architect</p>
              <h1 className="text-base font-medium text-app-fg">Keep it simple. Keep it moving.</h1>
            </div>
            <div className="flex min-w-0 flex-shrink-0 items-center gap-2 sm:gap-3">
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
              <p className="hidden truncate text-sm text-app-subtle md:block">{user?.email}</p>
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="rounded-md border border-app-border bg-white px-3 py-1.5 text-sm text-app-fg hover:bg-app-muted"
              >
                Sign out
              </button>
            </div>
          </header>
          <section className="flex-1 px-4 py-6 md:px-8">{children}</section>
        </main>
      </div>
      <BottomNav items={navItems} />
    </div>
  );
}
