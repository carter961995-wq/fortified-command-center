import { Card, PageHeader } from "../../../components/ui";
import { isSupabaseConfigured } from "../../../lib/env";

export default function SettingsPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader title="Settings" description="Environment, security, Google Workspace, Gemini, phone/text intake, and integration readiness." />
      <Card>
        <h2 className="text-lg font-black">Environment</h2>
        <dl className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-[#0c172b] p-3"><dt className="text-xs font-black uppercase text-slate-500">Supabase URL</dt><dd className="mt-1 font-bold text-white">{process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Missing"}</dd></div>
          <div className="rounded-xl bg-[#0c172b] p-3"><dt className="text-xs font-black uppercase text-slate-500">Anon key</dt><dd className="mt-1 font-bold text-white">{process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Set" : "Missing"}</dd></div>
          <div className="rounded-xl bg-[#0c172b] p-3"><dt className="text-xs font-black uppercase text-slate-500">Configured</dt><dd className="mt-1 font-bold text-white">{isSupabaseConfigured() ? "Yes" : "No / demo mode"}</dd></div>
        </dl>
      </Card>
      <Card>
        <h2 className="text-lg font-black text-white">Automation integrations</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            ["Google Workspace / Gmail", "OAuth connection for reading authorized mailboxes, labels, attachments, and customer/vendor message threads."],
            ["Gemini extraction", "Classify emails, texts, PDFs, and notes into draft leads, work orders, contacts, and invoice follow-up tasks."],
            ["Text messages", "Twilio or Google Voice style webhook intake to attach SMS conversations and phone numbers to customers."],
            ["Phone calls", "Call log import plus transcription hook for turning missed calls and voicemails into leads or client notes."],
          ].map(([title, body]) => (
            <div className="rounded-xl border border-[#223758] bg-[#0c172b] p-4" key={title}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-black text-white">{title}</h3>
                <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-[10px] font-black uppercase text-orange-300">Setup needed</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
            </div>
          ))}
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
