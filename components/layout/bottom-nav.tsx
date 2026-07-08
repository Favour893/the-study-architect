"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/layout/sidebar-nav";

const MOBILE_ACCENT: Record<string, { active: string; icon: string }> = {
  "/dashboard": {
    active: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    icon: "text-sky-600 dark:text-sky-400",
  },
  "/admin": {
    active: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
    icon: "text-indigo-600 dark:text-indigo-400",
  },
  "/courses": {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  "/logs": {
    active: "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
    icon: "text-teal-600 dark:text-teal-400",
  },
  "/timetable": {
    active: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    icon: "text-violet-600 dark:text-violet-400",
  },
  "/calculator": {
    active: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    icon: "text-amber-600 dark:text-amber-400",
  },
  "/onboarding": {
    active: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    icon: "text-rose-600 dark:text-rose-400",
  },
};

type BottomNavProps = {
  items: NavItem[];
};

export function BottomNav({ items }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-app-border bg-panel/95 px-2 py-2 shadow-[0_-4px_24px_rgba(30,58,138,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg justify-around gap-1">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          const mobile = MOBILE_ACCENT[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] transition ${
                isActive
                  ? `${mobile?.active ?? "bg-app-accent-soft text-app-accent"} font-medium`
                  : "text-app-subtle hover:text-app-accent"
              }`}
            >
              {Icon ? (
                <Icon className={`h-4 w-4 ${isActive ? mobile?.icon ?? "text-app-accent" : "text-app-subtle"}`} />
              ) : null}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
