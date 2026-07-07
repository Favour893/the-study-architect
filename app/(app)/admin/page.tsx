"use client";

import { useEffect, useMemo, useState } from "react";
import { Shield, Users, UserCheck, CalendarClock } from "lucide-react";
import { getClientAuth } from "@/lib/firebase/auth";
import type { AdminUsersDashboardResponse } from "@/lib/types/domain";
import { useAuth } from "@/providers/auth-provider";

export default function AdminDashboardPage() {
  const { user, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminUsersDashboardResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (isLoading) {
        return;
      }
      if (!user) {
        if (!cancelled) {
          setLoading(false);
          setError("Please sign in to access admin dashboard.");
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const firebaseUser = getClientAuth().currentUser;
        if (!firebaseUser) {
          throw new Error("Session not available.");
        }
        const idToken = await firebaseUser.getIdToken();
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const payload = (await res.json()) as AdminUsersDashboardResponse & { error?: string };
        if (!res.ok) {
          throw new Error(payload.error ?? "Could not load admin users.");
        }
        if (!cancelled) {
          setData(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load admin users.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [user, isLoading]);

  const metrics = useMemo(() => {
    return (
      data?.metrics ?? {
        totalUsers: 0,
        onboardedUsers: 0,
        usersWithActiveSemester: 0,
      }
    );
  }, [data]);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
        <div className="h-1 bg-gradient-to-r from-violet-500 via-sky-500 to-emerald-500" />
        <div className="p-5">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-app-violet" />
            <h2 className="text-lg font-semibold text-app-fg">Admin dashboard</h2>
          </div>
          <p className="mt-1 text-sm text-app-subtle">Overview of registered users and onboarding health.</p>
        </div>
      </section>

      {loading ? (
        <p className="rounded-xl border border-app-border bg-panel px-4 py-6 text-sm text-app-subtle">Loading admin data...</p>
      ) : error ? (
        <p className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-6 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </p>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-app-border bg-panel p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-app-subtle">
                <Users className="h-3.5 w-3.5" />
                Total users
              </p>
              <p className="mt-2 text-2xl font-semibold text-app-fg">{metrics.totalUsers}</p>
            </article>
            <article className="rounded-xl border border-app-border bg-panel p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-app-subtle">
                <UserCheck className="h-3.5 w-3.5" />
                Onboarded
              </p>
              <p className="mt-2 text-2xl font-semibold text-app-fg">{metrics.onboardedUsers}</p>
            </article>
            <article className="rounded-xl border border-app-border bg-panel p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-app-subtle">
                <CalendarClock className="h-3.5 w-3.5" />
                Active semester set
              </p>
              <p className="mt-2 text-2xl font-semibold text-app-fg">{metrics.usersWithActiveSemester}</p>
            </article>
          </section>

          <section className="overflow-hidden rounded-2xl border border-app-border bg-panel shadow-sm">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-sky-500" />
            <div className="p-4">
              <h3 className="text-base font-semibold text-app-fg">Users</h3>
              {data && data.users.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-app-border px-3 py-4 text-sm text-app-subtle">
                  No users found yet.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-app-border bg-app-accent-soft/30 text-left text-xs uppercase tracking-wide text-app-subtle">
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Onboarded</th>
                        <th className="px-3 py-2">Active semester</th>
                        <th className="px-3 py-2">Last updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.users.map((adminUser) => (
                        <tr key={adminUser.uid} className="border-b border-app-border/70">
                          <td className="px-3 py-2 text-app-fg">{adminUser.email ?? "—"}</td>
                          <td className="px-3 py-2 text-app-fg">{adminUser.displayName ?? "—"}</td>
                          <td className="px-3 py-2 text-app-fg">{adminUser.onboardingComplete ? "Yes" : "No"}</td>
                          <td className="px-3 py-2 text-app-fg">{adminUser.activeSemesterId ?? "—"}</td>
                          <td className="px-3 py-2 text-app-subtle">
                            {adminUser.updatedAtIso
                              ? new Date(adminUser.updatedAtIso).toLocaleString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
