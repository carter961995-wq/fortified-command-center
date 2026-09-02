import Link from "next/link";
import { BriefcaseBusiness, CalendarDays, ClipboardPlus, DollarSign, Hammer, Inbox, Plug, RadioTower, Workflow } from "lucide-react";
import { Badge, ErrorNotice } from "../../../components/ui";
import { displayValue, formatDate, money, type PlainRow } from "../../../lib/business";
import { fetchDashboardMetrics } from "../../../lib/data";
import { loadMhelpdeskConnection } from "../../../lib/integrations/mhelpdesk";
import { loadTruesourceConnection } from "../../../lib/integrations/truesource";
import { loadGoogleConnection } from "../../../lib/integrations/google";

function QueueCard({
  href,
  label,
  value,
  detail,
}: {
  href: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Link href={href} className="rounded-xl border border-[#2a4063] bg-[#13233f] p-5 hover:border-orange-400">
      <p className="text-xs font-black uppercase tracking-wide text-orange-200">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm font-semibold text-slate-200">{detail}</p>
      <p className="mt-3 text-sm font-black text-orange-300">Open →</p>
    </Link>
  );
}

function DashboardPanel({
  title,
  action,
  children,
  icon: Icon,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  icon: typeof CalendarDays;
}) {
  return (
    <section className="rounded-xl border border-[#2a4063] bg-[#111f38]">
      <div className="flex items-center justify-between border-b border-[#2a4063] px-5 py-4">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-orange-400" />
          <h2 className="font-black uppercase tracking-wide text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default async function DashboardPage() {
  const { metrics, recentWorkOrders, upcomingJobs, invoiceAttention, error } = await fetchDashboardMetrics();
  const [mhelpdesk, truesource, gmail] = await Promise.all([
    loadMhelpdeskConnection(),
    loadTruesourceConnection(),
    loadGoogleConnection(),
  ]);
  const activeJobs = Number(metrics.openWorkOrders ?? 0);
  const quoteDesk = Number(metrics.jobsNeedingQuotes ?? 0);
  const revenue = Math.max(0, Number(metrics.revenueThisMonth ?? 0));

  const sources = [
    {
      name: "mHelpDesk",
      href: "/job-sources",
      icon: Workflow,
      connected: Boolean(mhelpdesk),
      detail: mhelpdesk?.email || "Connect the account that emails you new jobs",
    },
    {
      name: "TrueSource",
      href: "/job-sources",
      icon: RadioTower,
      connected: Boolean(truesource),
      detail: truesource?.email || "Affiliate Connect assignments from national accounts",
    },
    {
      name: "Gmail",
      href: "/job-sources",
      icon: Inbox,
      connected: Boolean(gmail),
      detail: gmail?.email || "Needed for email-bridge imports",
    },
  ];

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">Command Center</p>
          <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">Pick a source. Run the job.</h1>
          <p className="mt-2 max-w-2xl text-base font-semibold text-slate-200">
            This is the shop OS. mHelpDesk and TrueSource are just inboxes — connect them, then work everything here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-slate-950 hover:bg-orange-400" href="/work-orders/new">
            <ClipboardPlus className="size-4" />
            New work order
          </Link>
          <Link className="inline-flex items-center gap-2 rounded-lg border border-slate-500 bg-[#13233f] px-4 py-2 text-sm font-black text-white hover:border-orange-300" href="/job-intake">
            <Inbox className="size-4" />
            Job Intake
          </Link>
          <Link className="inline-flex items-center gap-2 rounded-lg border border-slate-500 bg-[#13233f] px-4 py-2 text-sm font-black text-white hover:border-orange-300" href="/job-sources">
            <Plug className="size-4" />
            Job sources
          </Link>
        </div>
      </header>
      <ErrorNotice message={error} />

      <section className="grid gap-3 lg:grid-cols-3">
        {sources.map((source) => {
          const Icon = source.icon;
          return (
            <Link key={source.name} href={source.href} className="flex items-center gap-3 rounded-xl border border-[#2a4063] bg-[#13233f] p-4 hover:border-orange-400">
              <span className="flex size-11 items-center justify-center rounded-lg bg-[#0c172b] text-orange-300">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-white">{source.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-black uppercase ${source.connected ? "bg-emerald-500/20 text-emerald-200" : "bg-slate-700 text-slate-100"}`}>
                    {source.connected ? "Connected" : "Not set up"}
                  </span>
                </span>
                <span className="mt-1 block truncate text-sm font-semibold text-slate-200">{source.detail}</span>
              </span>
              <span className="text-sm font-black text-orange-300">{source.connected ? "Manage" : "Set up"}</span>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <QueueCard href="/jobs" label="Active jobs" value={String(activeJobs)} detail="Open work on the board" />
        <QueueCard href="/job-intake" label="Intake" value="Open" detail="Parsed mHelpDesk / TrueSource jobs" />
        <QueueCard href="/jobs" label="Quote desk" value={String(quoteDesk)} detail="Needs a number or site facts" />
        <QueueCard href="/invoices" label="Cash" value={money(revenue)} detail={`${metrics.unpaidInvoices ?? 0} unpaid invoices`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.7fr]">
        <DashboardPanel
          title="Today's Schedule"
          icon={CalendarDays}
          action={<Link className="text-sm font-black text-orange-300 hover:text-orange-200" href="/planner">View all</Link>}
        >
          {upcomingJobs.length ? (
            <div className="grid gap-3">
              {upcomingJobs.slice(0, 4).map((row) => (
                <Link className="rounded-xl border border-[#2a4063] bg-[#0c172b] p-3 hover:border-orange-400" href={`/work-orders/${String(row.id)}`} key={String(row.id)}>
                  <p className="font-black text-white">{displayValue(row, "title")}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-200">Scheduled {formatDate(row.scheduled_date)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="font-semibold text-slate-200">Schedule is clear. Pull a job from intake.</p>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Select a job"
          icon={Hammer}
          action={<Link className="text-sm font-black text-orange-300 hover:text-orange-200" href="/jobs">See board</Link>}
        >
          {recentWorkOrders.length ? (
            <div className="grid gap-3">
              {recentWorkOrders.slice(0, 5).map((row) => (
                <Link className="rounded-xl border border-[#2a4063] bg-[#0c172b] p-4 hover:border-orange-400" href={`/work-orders/${String(row.id)}`} key={String(row.id)}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-white">{displayValue(row, "work_order_number")} · {displayValue(row, "title")}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-200">Due {formatDate(row.due_date)} · Scheduled {formatDate(row.scheduled_date)}</p>
                    </div>
                    <Badge>{displayValue(row, "status")}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="font-semibold text-slate-200">No active jobs. Create one or connect a source.</p>
          )}
        </DashboardPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DashboardPanel
          title="Invoices"
          icon={DollarSign}
          action={<Link className="text-sm font-black text-orange-300 hover:text-orange-200" href="/invoices">Open invoices</Link>}
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-[#0c172b] p-3">
              <p className="text-xs font-bold text-slate-300">Unpaid</p>
              <p className="text-2xl font-black text-white">{String(metrics.unpaidInvoices ?? 0)}</p>
            </div>
            <div className="rounded-lg bg-[#0c172b] p-3">
              <p className="text-xs font-bold text-slate-300">Overdue</p>
              <p className="text-2xl font-black text-red-300">{String(metrics.overdueInvoices ?? 0)}</p>
            </div>
            <div className="rounded-lg bg-[#0c172b] p-3">
              <p className="text-xs font-bold text-slate-300">Ready</p>
              <p className="text-2xl font-black text-orange-300">{String(metrics.readyToInvoice ?? 0)}</p>
            </div>
          </div>
          <div className="grid gap-3">
            {invoiceAttention.slice(0, 4).map((row) => (
              <Link className="flex items-center justify-between rounded-lg border border-[#2a4063] bg-[#0c172b] p-3 hover:border-orange-400" href={`/invoices/${String(row.id)}`} key={String(row.id)}>
                <span className="font-black text-white">{displayValue(row, "invoice_number")}</span>
                <span className="text-sm font-bold text-orange-200">{money(row.balance_due)}</span>
              </Link>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel title="What to do next" icon={BriefcaseBusiness}>
          <div className="grid gap-3">
            <Link className="rounded-lg border border-[#2a4063] bg-[#0c172b] p-4 hover:border-orange-400" href="/job-sources">
              <p className="font-black text-white">1. Connect mHelpDesk or TrueSource</p>
              <p className="mt-1 text-sm font-semibold text-slate-200">Save the login / email bridge. Do not keep working inside those apps.</p>
            </Link>
            <Link className="rounded-lg border border-[#2a4063] bg-[#0c172b] p-4 hover:border-orange-400" href="/job-intake">
              <p className="font-black text-white">2. Open Job Intake and select a job</p>
              <p className="mt-1 text-sm font-semibold text-slate-200">Add notes, set a date, then accept it onto the board.</p>
            </Link>
            <Link className="rounded-lg border border-[#2a4063] bg-[#0c172b] p-4 hover:border-orange-400" href="/jobs">
              <p className="font-black text-white">3. Run it from Jobs</p>
              <p className="mt-1 text-sm font-semibold text-slate-200">Schedule, assign a sub, invoice, and close it here.</p>
            </Link>
          </div>
        </DashboardPanel>
      </section>
    </div>
  );
}
