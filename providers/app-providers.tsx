"use client";

import { FocusSelectProvider } from "@/providers/focus-select-provider";
import { AuthProvider } from "@/providers/auth-provider";

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <FocusSelectProvider>{children}</FocusSelectProvider>
    </AuthProvider>
  );
}
