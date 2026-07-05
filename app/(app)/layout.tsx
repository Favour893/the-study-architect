import { AuthGate } from "@/components/auth/auth-gate";
import { AppProviders } from "@/components/providers/app-providers";
import { AppGuideHost } from "@/components/onboarding/app-guide-host";
import { AppShell } from "@/components/layout/app-shell";

type AppLayoutProps = {
  children: React.ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <AuthGate>
      <AppProviders>
        <AppShell>{children}</AppShell>
        <AppGuideHost />
      </AppProviders>
    </AuthGate>
  );
}
