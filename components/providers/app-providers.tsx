"use client";

import { SemesterProvider } from "@/providers/semester-provider";
import { ToastProvider } from "@/providers/toast-provider";

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ToastProvider>
      <SemesterProvider>{children}</SemesterProvider>
    </ToastProvider>
  );
}
