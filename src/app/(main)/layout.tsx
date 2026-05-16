import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/require-staff";

export default async function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireStaff();

  return (
    <AppShell
      profileName={profile.full_name || profile.email || "User"}
      profileEmail={profile.email}
    >
      {children}
    </AppShell>
  );
}
