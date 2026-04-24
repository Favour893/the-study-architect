"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/layout/sidebar-nav";

type BottomNavProps = {
  items: NavItem[];
};

export function BottomNav({ items }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-app-border bg-panel/95 px-2 py-2 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg justify-around gap-1">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-[11px] transition ${
                isActive ? "bg-app-muted font-medium text-app-fg" : "text-app-subtle"
              }`}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
