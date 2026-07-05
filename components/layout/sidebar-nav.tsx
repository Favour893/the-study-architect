"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TsaLogoMark } from "@/components/brand/tsa-logo-mark";
import { NAV_ACCENTS } from "@/lib/ui/accents";
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
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-blue-950/40 bg-app-sidebar px-3 py-5 text-app-sidebar-fg md:flex">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <TsaLogoMark className="h-9 w-9 shrink-0" />
        <div>
          <p className="text-sm font-semibold tracking-tight text-app-sidebar-fg">The Study Architect</p>
          <p className="text-[11px] text-app-sidebar-muted">Academic companion</p>
        </div>
      </div>
      <nav className="space-y-1">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          const accent = NAV_ACCENTS[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition ${
                isActive
                  ? `bg-white/15 font-medium text-white shadow-sm ring-1 ${accent?.activeRing ?? "ring-white/25"}`
                  : "text-app-sidebar-muted hover:bg-white/10 hover:text-white"
              }`}
            >
              {Icon ? (
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                    accent?.iconBg ?? "bg-white/10"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${accent?.iconText ?? "text-app-sidebar-muted"}`} />
                </span>
              ) : null}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
