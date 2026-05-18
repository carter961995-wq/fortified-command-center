import { redirect } from "next/navigation";
import { AdminShell } from "../../components/admin-shell";
import { getSessionContext } from "../../lib/data";
import { isSupabaseConfigured } from "../../lib/env";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return <AdminShell envWarning="Supabase is not configured. Add environment variables and run the migration before using live data.">{children}</AdminShell>;
  }
  const { user, profile } = await getSessionContext();
  if (!user) redirect("/login");
  return <AdminShell profile={profile}>{children}</AdminShell>;
}
