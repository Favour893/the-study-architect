import { AuthGate } from "@/components/auth/auth-gate";
import { AppProviders } from "@/components/providers/app-providers";
import { PageGuideRouter } from "@/components/onboarding/page-guide-router";
import { AppShell } from "@/components/layout/app-shell";

type AppLayoutProps = {
  children: React.ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <AuthGate>
      <AppProviders>
        <AppShell>{children}</AppShell>
        <PageGuideRouter />
      </AppProviders>
    </AuthGate>
  );
}
