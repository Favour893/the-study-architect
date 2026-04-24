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
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 justify-center rounded-md px-2 py-2 text-xs transition ${
                isActive ? "bg-app-muted font-medium text-app-fg" : "text-app-subtle"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
