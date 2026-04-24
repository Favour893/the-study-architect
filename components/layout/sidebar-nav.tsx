"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

export type NavItem = {
  href: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
};

type SidebarNavProps = {
  items: NavItem[];
};

export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 shrink-0 border-r border-app-border bg-panel px-4 py-6 md:block">
      <p className="mb-8 px-2 text-sm font-medium uppercase tracking-wide text-app-subtle">TSA</p>
      <nav className="space-y-1">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-base transition ${
                isActive ? "bg-app-muted font-medium text-app-fg" : "text-app-subtle hover:bg-app-muted"
              }`}
            >
              {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
