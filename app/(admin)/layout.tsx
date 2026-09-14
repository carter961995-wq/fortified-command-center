import { redirect } from "next/navigation";
import { AdminShell } from "../../components/admin-shell";
import { getSessionContext } from "../../lib/data";
import { isDemoMode, isSupabaseConfigured } from "../../lib/env";
import { ensureDemoIntegrations } from "../../lib/integrations/demo-bootstrap";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (isDemoMode()) {
    await ensureDemoIntegrations();
    const { profile } = await getSessionContext();
    return (
      <AdminShell
        profile={profile}
        envWarning="Demo mode: shop sources (Gmail, mHelpDesk, TrueSource) and seeded jobs are live. Restarting the server resets in-memory records."
      >
        {children}
      </AdminShell>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <AdminShell envWarning="Live local mode. Sign in with Gmail or log in to mHelpDesk / Affiliate Connect — the Command Center pulls and organizes the work from there.">
        {children}
      </AdminShell>
    );
  }
  const { user, profile } = await getSessionContext();
  if (!user) redirect("/login");
  return <AdminShell profile={profile}>{children}</AdminShell>;
}
