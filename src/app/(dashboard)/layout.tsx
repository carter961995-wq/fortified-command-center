import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/require-staff";
import { isDemoMode } from "@/lib/demo-mode";

export default async function DashboardLegacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireStaff();

  return (
    <AppShell
      profileName={profile.full_name || profile.email || "User"}
      profileEmail={profile.email}
      demoMode={isDemoMode()}
    >
      {children}
    </AppShell>
  );
}
