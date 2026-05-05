import { AuthGate } from "@/components/auth/auth-gate";
import { AppProviders } from "@/components/providers/app-providers";
import { AppShell } from "@/components/layout/app-shell";

type AppLayoutProps = {
  children: React.ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <AuthGate>
      <AppProviders>
        <div>testing</div>
        <AppShell>{children}</AppShell>
      </AppProviders>
    </AuthGate>
  );
}
