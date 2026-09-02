import Link from "next/link";
import { JobSourcesSetup } from "../../../../components/job-sources-setup";

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">Settings</p>
        <h1 className="mt-2 text-3xl font-black text-white">Shop setup</h1>
        <p className="mt-2 max-w-3xl text-base leading-7 text-slate-200">
          Connect job sources first. Stripe and QuickBooks stay parked until billing export is live.
        </p>
      </header>

      <JobSourcesSetup googleMessage={sp.google} />

      <section className="grid gap-3 md:grid-cols-2">
        <div className="panel p-5">
          <h2 className="font-black text-white">Payments</h2>
          <p className="mt-2 text-sm text-slate-200">Stripe card/ACH capture will plug in here. Record payments on invoices today.</p>
          <Link href="/invoices" className="mt-4 inline-flex text-sm font-bold text-orange-300">
            Open invoices
          </Link>
        </div>
        <div className="panel p-5">
          <h2 className="font-black text-white">Accounting</h2>
          <p className="mt-2 text-sm text-slate-200">QuickBooks export is not wired yet. Keep invoices in this app as the source of truth.</p>
          <Link href="/reports" className="mt-4 inline-flex text-sm font-bold text-orange-300">
            Open reports
          </Link>
        </div>
      </section>
    </div>
  );
}
