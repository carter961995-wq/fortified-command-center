import { Card, PageHeader } from "../../../components/ui";
import { JobSourcesSetup } from "../../../components/job-sources-setup";
import { isSupabaseConfigured } from "../../../lib/env";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader title="Settings" description="Connect mHelpDesk, TrueSource, and Gmail here. This app is the shop OS — those portals stay as inboxes." />
      <Card>
        <h2 className="text-lg font-black">Environment</h2>
        <dl className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-[#0c172b] p-3"><dt className="text-xs font-black uppercase text-slate-500">Supabase URL</dt><dd className="mt-1 font-bold text-white">{process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Missing"}</dd></div>
          <div className="rounded-xl bg-[#0c172b] p-3"><dt className="text-xs font-black uppercase text-slate-500">Anon key</dt><dd className="mt-1 font-bold text-white">{process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Set" : "Missing"}</dd></div>
          <div className="rounded-xl bg-[#0c172b] p-3"><dt className="text-xs font-black uppercase text-slate-500">Configured</dt><dd className="mt-1 font-bold text-white">{isSupabaseConfigured() ? "Yes" : "No / demo mode"}</dd></div>
        </dl>
      </Card>
      <Card>
        <h2 className="text-lg font-black text-white">Job sources</h2>
        <p className="mt-2 text-sm font-semibold text-slate-200">
          Select mHelpDesk, TrueSource, or Gmail. Save the connection, then work jobs in Job Intake.
        </p>
        <div className="mt-4">
          <JobSourcesSetup googleMessage={sp.google} />
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-black">Security notes</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-400">
          <li>All dashboard routes are protected with Supabase Auth middleware when Supabase is configured.</li>
          <li>The service role key is server-only and is not used by browser code.</li>
          <li>RLS policies in the migration grant owner/admin access now, with future subcontractor/customer scoped policies.</li>
          <li>Google/Gemini/text/call automations need real API credentials, OAuth consent, and webhook URLs before they can process live data.</li>
        </ul>
      </Card>
    </div>
  );
}
