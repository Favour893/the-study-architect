import { ShimmerBlock, ShimmerDashboard, ShimmerPageHeader } from "@/components/ui/shimmer";

export default function Loading() {
  return (
    <main className="min-h-screen bg-app px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <ShimmerPageHeader />
        <ShimmerDashboard />
        <div className="grid gap-4 md:grid-cols-2">
          <ShimmerBlock className="h-28 rounded-2xl" />
          <ShimmerBlock className="h-28 rounded-2xl" />
        </div>
      </div>
    </main>
  );
}
