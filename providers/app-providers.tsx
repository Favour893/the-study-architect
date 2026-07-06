"use client";

import { FocusSelectProvider } from "@/providers/focus-select-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { AlarmEngine } from "@/components/alarms/alarm-engine";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FocusSelectProvider>
          {children}
          <ServiceWorkerRegister />
          <AlarmEngine />
          <InstallPrompt />
        </FocusSelectProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
