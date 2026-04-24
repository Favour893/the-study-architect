export default function Loading() {
  return (
    <main className="min-h-screen bg-app px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-10 w-1/3 animate-pulse rounded-lg bg-app-muted" />
        <div className="h-40 animate-pulse rounded-2xl bg-app-muted" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-28 animate-pulse rounded-2xl bg-app-muted" />
          <div className="h-28 animate-pulse rounded-2xl bg-app-muted" />
        </div>
      </div>
    </main>
  );
}
