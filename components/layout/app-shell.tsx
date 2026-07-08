"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, Clock3, Gauge, NotebookPen, Shield, Sigma } from "lucide-react";
import { getClientAuth } from "@/lib/firebase/auth";
import { useSemester } from "@/providers/semester-provider";
import { useAuth } from "@/providers/auth-provider";
import { NotificationHeaderControl } from "@/components/alarms/notification-header-control";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarNav, type NavItem } from "@/components/layout/sidebar-nav";
import { UserProfileMenu } from "@/components/layout/user-profile-menu";

type AppShellProps = {
  children: React.ReactNode;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Pulse", icon: Gauge },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/logs", label: "Personal Logs", icon: NotebookPen },
  { href: "/timetable", label: "Timetable", icon: Clock3 },
  { href: "/calculator", label: "Grade Calculator", icon: Sigma },
  { href: "/onboarding", label: "Semester", icon: CalendarDays },
];

export function AppShell({ children }: AppShellProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { semesters, activeSemesterId, isLoading: semesterLoading, setActiveSemester } = useSemester();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAdminAccess() {
      if (authLoading || !user) {
        if (!cancelled) {
          setIsAdmin(false);
        }
        return;
      }

      try {
        const firebaseUser = getClientAuth().currentUser;
        if (!firebaseUser) {
          if (!cancelled) {
            setIsAdmin(false);
          }
          return;
        }
        const idToken = await firebaseUser.getIdToken();
        const response = await fetch("/api/admin/access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (!cancelled) {
          setIsAdmin(response.ok);
        }
      } catch {
        if (!cancelled) {
          setIsAdmin(false);
        }
      }
    }

    void checkAdminAccess();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const navItemsWithAccess = useMemo(() => {
    if (!isAdmin) {
      return navItems;
    }
    return [{ href: "/admin", label: "Admin", icon: Shield }, ...navItems];
  }, [isAdmin]);

  return (
    <div className="h-dvh bg-app">
      <div className="flex h-full w-full">
        <SidebarNav items={navItemsWithAccess} />
        <main className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col">
          <header className="relative z-10 flex h-14 min-w-0 shrink-0 items-center justify-between gap-2 border-b border-app-border bg-panel/90 px-3 shadow-sm backdrop-blur md:px-6">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-sky-500 via-violet-500 to-amber-400" />
            <div className="min-w-0 pr-2">
              <p className="bg-gradient-to-r from-app-accent via-app-violet to-app-teal bg-clip-text text-xs font-semibold text-transparent">
                The Study Architect
              </p>
              <h1 className="truncate text-sm font-medium text-app-fg">Plan smart. Study well.</h1>
            </div>
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              {semesters.length > 0 ? (
                <label className="flex min-w-0 max-w-[44vw] items-center gap-1.5 sm:max-w-[220px]">
                  <span className="hidden text-xs text-app-subtle sm:inline">Semester</span>
                  <select
                    value={activeSemesterId ?? ""}
                    disabled={semesterLoading}
                    onChange={(event) => void setActiveSemester(event.target.value)}
                    className="min-w-0 flex-1 truncate rounded-md border border-app-border bg-app-accent-soft px-2 py-1.5 text-xs text-app-fg outline-none ring-app-accent focus:ring-2 sm:text-sm"
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
              <NotificationHeaderControl />
              <UserProfileMenu />
            </div>
          </header>
          <section className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto px-3 py-4 pb-24 md:px-6 md:pb-4">
            {children}
          </section>
        </main>
      </div>
      <BottomNav items={navItemsWithAccess} />
    </div>
  );
}
