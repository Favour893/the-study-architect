import type { ReactNode } from "react";

type ShimmerProps = {
  className?: string;
};

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Shimmer({ className }: ShimmerProps) {
  return <div aria-hidden className={joinClasses("tsa-shimmer", className)} />;
}

export function ShimmerLine({ className, width = "w-full" }: ShimmerProps & { width?: string }) {
  return <Shimmer className={joinClasses("h-3 rounded-md", width, className)} />;
}

export function ShimmerBlock({ className }: ShimmerProps) {
  return <Shimmer className={joinClasses("rounded-xl", className)} />;
}

type ShimmerPanelProps = {
  barClassName?: string;
  bodyClassName?: string;
  children?: ReactNode;
  className?: string;
};

export function ShimmerPanel({
  barClassName = "from-sky-500 via-violet-500 to-amber-400",
  bodyClassName = "h-40",
  children,
  className,
}: ShimmerPanelProps) {
  return (
    <section className={joinClasses("overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm", className)}>
      <Shimmer className={joinClasses("h-1 bg-gradient-to-r", barClassName)} />
      <div className={joinClasses("p-6", bodyClassName)}>
        {children ?? (
          <div className="space-y-3">
            <ShimmerLine width="w-1/3" />
            <ShimmerLine width="w-2/3" />
            <ShimmerLine width="w-1/2" />
          </div>
        )}
      </div>
    </section>
  );
}

export function ShimmerPageHeader() {
  return (
    <div className="space-y-2">
      <ShimmerLine width="w-28" className="h-3" />
      <ShimmerLine width="w-44" className="h-6" />
    </div>
  );
}

export function ShimmerList({ count = 4, itemClassName = "h-16" }: { count?: number; itemClassName?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <ShimmerBlock key={index} className={joinClasses(itemClassName, "rounded-xl")} />
      ))}
    </div>
  );
}

export function ShimmerStatGrid({ count = 3 }: { count?: number }) {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <ShimmerBlock key={index} className="h-24 rounded-xl" />
      ))}
    </section>
  );
}

export function ShimmerCourseCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      <ShimmerBlock className="h-12 rounded-xl" />
      {Array.from({ length: count }).map((_, index) => (
        <ShimmerBlock key={index} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

export function ShimmerDashboard() {
  return (
    <div className="space-y-6">
      <ShimmerPanel barClassName="from-sky-500 via-violet-500 to-amber-400" bodyClassName="min-h-[220px]">
        <div className="space-y-4">
          <ShimmerLine width="w-24" />
          <ShimmerLine width="w-2/3" className="h-5" />
          <ShimmerLine width="w-full" />
          <ShimmerBlock className="h-2.5 w-full rounded-full" />
          <ShimmerBlock className="h-10 w-48 rounded-lg" />
        </div>
      </ShimmerPanel>
      <ShimmerPanel barClassName="from-amber-500 via-rose-500 to-violet-500" bodyClassName="min-h-[200px]">
        <div className="space-y-3">
          <ShimmerLine width="w-32" className="h-5" />
          <ShimmerLine width="w-full" />
          <ShimmerList count={4} itemClassName="h-14" />
        </div>
      </ShimmerPanel>
    </div>
  );
}

export function ShimmerTimetable() {
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-app-border bg-panel shadow-sm">
        <Shimmer className="h-1 bg-gradient-to-r from-sky-500 via-violet-500 to-rose-500" />
        <div className="space-y-3 border-b border-app-border p-3">
          <div className="flex gap-3">
            <ShimmerBlock className="h-8 w-24 rounded-md" />
            <ShimmerBlock className="h-8 w-24 rounded-md" />
            <ShimmerBlock className="h-8 w-8 rounded-full" />
          </div>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 30 }).map((_, index) => (
              <ShimmerBlock key={index} className="h-12 rounded-md" />
            ))}
          </div>
        </div>
      </section>
      <ShimmerPanel barClassName="from-rose-500 to-amber-500" bodyClassName="h-32" />
    </div>
  );
}

export function ShimmerAppShell() {
  return (
    <div className="flex min-h-screen bg-app">
      <aside className="hidden w-56 shrink-0 border-r border-app-border bg-panel p-4 md:block">
        <div className="space-y-4">
          <ShimmerBlock className="h-8 w-32 rounded-lg" />
          <ShimmerList count={6} itemClassName="h-9" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-app-border bg-panel px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <ShimmerBlock className="h-9 w-40 rounded-lg" />
            <div className="flex gap-2">
              <ShimmerBlock className="h-9 w-24 rounded-lg" />
              <ShimmerBlock className="h-9 w-9 rounded-full" />
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <ShimmerDashboard />
        </main>
      </div>
    </div>
  );
}

export function ShimmerAuthPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-app-accent-dark via-app-accent to-indigo-600 px-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur">
        <Shimmer className="mx-auto h-12 w-12 rounded-full bg-white/20" />
        <Shimmer className="mx-auto h-4 w-40 rounded-md bg-white/20" />
        <ShimmerBlock className="h-11 rounded-lg bg-white/20" />
        <ShimmerBlock className="h-11 rounded-lg bg-white/20" />
        <ShimmerBlock className="h-11 rounded-lg bg-white/20" />
      </div>
    </main>
  );
}

export function ShimmerPage({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={joinClasses("space-y-5", className)}>{children}</div>;
}
