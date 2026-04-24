"use client";

import {
  getUserProfile,
  listUserSemesters,
  setProfileActiveSemester,
} from "@/lib/data/semesters";
import type { Semester } from "@/lib/types/domain";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type SemesterContextValue = {
  activeSemesterId: string | null;
  semesters: Semester[];
  isLoading: boolean;
  setActiveSemester: (semesterId: string) => Promise<void>;
  refreshSemesters: () => Promise<void>;
};

const SemesterContext = createContext<SemesterContextValue | null>(null);

export function SemesterProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSemesters = useCallback(async () => {
    if (!user) {
      setSemesters([]);
      setActiveSemesterId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [profile, list] = await Promise.all([getUserProfile(user.uid), listUserSemesters(user.uid)]);
      setSemesters(list);
      const ids = new Set(list.map((s) => s.id));

      let nextActive = profile?.activeSemesterId ?? null;
      if (nextActive && !ids.has(nextActive)) {
        nextActive = list.find((s) => !s.isArchived)?.id ?? list[0]?.id ?? null;
        if (nextActive) {
          await setProfileActiveSemester(user.uid, nextActive);
        }
      }
      if (!nextActive && list.length > 0) {
        nextActive = list.find((s) => !s.isArchived)?.id ?? list[0].id;
        await setProfileActiveSemester(user.uid, nextActive);
      }

      setActiveSemesterId(nextActive);
    } catch {
      pushToast(
        "Could not load semesters from the cloud. Check your connection.",
        "error",
        "semesters-sync",
      );
      setSemesters([]);
      setActiveSemesterId(null);
    } finally {
      setIsLoading(false);
    }
  }, [user, pushToast]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refreshSemesters();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refreshSemesters]);

  const setActiveSemester = useCallback(
    async (semesterId: string) => {
      if (!user) {
        return;
      }
      try {
        await setProfileActiveSemester(user.uid, semesterId);
        setActiveSemesterId(semesterId);
      } catch {
        pushToast("Could not switch semester. Try again.", "error");
      }
    },
    [user, pushToast],
  );

  const value = useMemo(
    () => ({
      activeSemesterId,
      semesters,
      isLoading,
      setActiveSemester,
      refreshSemesters,
    }),
    [activeSemesterId, semesters, isLoading, setActiveSemester, refreshSemesters],
  );

  return <SemesterContext.Provider value={value}>{children}</SemesterContext.Provider>;
}

export function useSemester() {
  const ctx = useContext(SemesterContext);
  if (!ctx) {
    throw new Error("useSemester must be used within SemesterProvider");
  }
  return ctx;
}
