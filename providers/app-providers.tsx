"use client";

import { FocusSelectProvider } from "@/providers/focus-select-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FocusSelectProvider>{children}</FocusSelectProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
