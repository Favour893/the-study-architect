"use client";

import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, Clock3, Gauge, Sigma } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useSemester } from "@/providers/semester-provider";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarNav, type NavItem } from "@/components/layout/sidebar-nav";
import { UserProfileMenu } from "@/components/layout/user-profile-menu";

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

function matchesNavHref(pathname: string, href: string) {
  if (pathname === href) {
    return true;
  }
  return href !== "/" && pathname.startsWith(`${href}/`);
}

function MainSectionArrows() {
  const pathname = usePathname();
  const router = useRouter();
  const idx = navItems.findIndex((item) => matchesNavHref(pathname, item.href));
  const safeIdx = idx >= 0 ? idx : 0;

  function go(delta: number) {
    const next = (safeIdx + delta + navItems.length) % navItems.length;
    router.push(navItems[next].href);
  }

  return (
    <div className="hidden shrink-0 items-center gap-0.5 sm:flex" role="group" aria-label="Main sections">
      <button
        type="button"
        onClick={() => go(-1)}
        className="rounded-md border border-app-border bg-white p-1 text-app-fg shadow-sm hover:bg-app-muted"
        aria-label="Previous page section"
        title="Previous section"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        className="rounded-md border border-app-border bg-white p-1 text-app-fg shadow-sm hover:bg-app-muted"
        aria-label="Next page section"
        title="Next section"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  const { semesters, activeSemesterId, isLoading: semesterLoading, setActiveSemester } = useSemester();

  return (
    <div className="h-dvh bg-app">
      <div className="flex h-full w-full">
        <SidebarNav items={navItems} />
        <main className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col">
          <header className="z-10 flex h-14 min-w-0 shrink-0 items-center justify-between gap-2 border-b border-app-border bg-app/80 px-3 backdrop-blur md:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2 pr-2">
              <MainSectionArrows />
              <div className="min-w-0">
                <p className="text-xs text-app-subtle">The Study Architect</p>
                <h1 className="truncate text-sm font-medium text-app-fg">Keep it simple. Keep it moving.</h1>
              </div>
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
              <UserProfileMenu />
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
