import { Card, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/env";

export default function SettingsPage() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Settings" description="Environment, security, and integration readiness for the internal admin dashboard." />
      <Card>
        <h2 className="text-lg font-black">Environment</h2>
        <dl className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-stone-50 p-3"><dt className="text-xs font-black uppercase text-stone-500">Supabase URL</dt><dd className="mt-1 font-bold">{process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Missing"}</dd></div>
          <div className="rounded-xl bg-stone-50 p-3"><dt className="text-xs font-black uppercase text-stone-500">Anon key</dt><dd className="mt-1 font-bold">{process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Set" : "Missing"}</dd></div>
          <div className="rounded-xl bg-stone-50 p-3"><dt className="text-xs font-black uppercase text-stone-500">Configured</dt><dd className="mt-1 font-bold">{isSupabaseConfigured() ? "Yes" : "No"}</dd></div>
        </dl>
      </Card>
      <Card>
        <h2 className="text-lg font-black">Security notes</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-stone-700">
          <li>All dashboard routes are protected with Supabase Auth middleware when Supabase is configured.</li>
          <li>The service role key is server-only and is not used by browser code.</li>
          <li>RLS policies in the migration grant owner/admin access now, with future subcontractor/customer scoped policies.</li>
          <li>Stripe and QuickBooks are intentionally not implemented yet; the schema is ready for future integration references.</li>
        </ul>
      </Card>
    </div>
  );
}
