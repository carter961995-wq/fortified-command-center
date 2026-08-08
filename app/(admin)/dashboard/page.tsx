import Link from "next/link";
import { BriefcaseBusiness, CalendarDays, DollarSign, Hammer, Inbox, Users } from "lucide-react";
import { Badge, ErrorNotice } from "../../../components/ui";
import { displayValue, formatDate, money, type PlainRow } from "../../../lib/business";
import { fetchDashboardMetrics } from "../../../lib/data";

function MetricCard({
  label,
  value,
  icon: Icon,
  watermark,
  tone = "orange",
}: {
  label: string;
  value: string;
  icon: typeof BriefcaseBusiness;
  watermark: string;
  tone?: "orange" | "green" | "blue";
}) {
  const tones = {
    orange: "bg-orange-500/15 text-orange-400",
    green: "bg-emerald-500/15 text-emerald-400",
    blue: "bg-blue-500/15 text-blue-400",
  };
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#1f304d] bg-[#13233f] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)]">
      <div className="flex items-center gap-4">
        <div className={`flex size-11 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="size-6" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-400">{label}</p>
          <p className="mt-1 text-3xl font-black text-white">{value}</p>
        </div>
      </div>
      <div className="pointer-events-none absolute -right-3 -top-7 text-[112px] font-black leading-none text-white/5">
        {watermark}
      </div>
    </div>
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
    <section className="rounded-xl border border-[#1f304d] bg-[#111f38] shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between border-b border-[#1f304d] px-5 py-4">
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
  const activeJobs = Number(metrics.openWorkOrders ?? 0);
  const pipelineValue = Number(metrics.revenueThisMonth ?? 0) + Number(metrics.grossProfitThisMonth ?? 0);
  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="pt-3">
        <h1 className="text-4xl font-black uppercase tracking-tight text-white md:text-5xl">WELCOME BACK, BOSS</h1>
        <p className="mt-2 text-lg font-semibold text-slate-400">Here&apos;s your battle plan for {formatDate(new Date().toISOString())}.</p>
      </header>
      <ErrorNotice message={error} />
      <section className="grid gap-5 md:grid-cols-3">
        <MetricCard label="Active Jobs" value={String(activeJobs)} icon={BriefcaseBusiness} watermark="▣" />
        <MetricCard label="Pipeline Value" value={money(pipelineValue)} icon={DollarSign} watermark="$" tone="green" />
        <MetricCard label="Leads to Call" value={String(metrics.jobsNeedingQuotes ?? 0)} icon={Users} watermark="♙" tone="blue" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.7fr]">
        <DashboardPanel
          title="Today's Schedule"
          icon={CalendarDays}
          action={<Link className="text-xs font-black text-orange-400 hover:text-orange-300" href="/planner">View All</Link>}
        >
          {upcomingJobs.length ? (
            <div className="grid gap-3">
              {upcomingJobs.slice(0, 4).map((row) => (
                <Link className="rounded-xl border border-[#223758] bg-[#0c172b] p-3 hover:border-orange-500/40" href={`/work-orders/${String(row.id)}`} key={String(row.id)}>
                  <p className="font-black text-white">{displayValue(row, "title")}</p>
                  <p className="mt-1 text-sm text-slate-400">Scheduled {formatDate(row.scheduled_date)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center text-center text-slate-500">
              <div className="mb-4 flex size-10 items-center justify-center rounded-full border border-[#2b4168]">✓</div>
              <p className="font-semibold">Schedule is clear today.</p>
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Active Jobs"
          icon={Hammer}
          action={<Link className="text-xs font-black text-orange-400 hover:text-orange-300" href="/jobs">See Board →</Link>}
        >
          {recentWorkOrders.length ? (
            <div className="grid gap-3">
              {recentWorkOrders.slice(0, 5).map((row) => (
                <Link className="rounded-xl border border-dashed border-[#284164] bg-[#0c172b]/70 p-4 hover:border-orange-500/50" href={`/work-orders/${String(row.id)}`} key={String(row.id)}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-white">{displayValue(row, "work_order_number")} · {displayValue(row, "title")}</p>
                      <p className="mt-1 text-sm text-slate-400">Due {formatDate(row.due_date)} · Scheduled {formatDate(row.scheduled_date)}</p>
                    </div>
                    <Badge>{displayValue(row, "status")}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-[#284164] text-slate-500">
              No active jobs found.
            </div>
          )}
        </DashboardPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DashboardPanel
          title="Invoicing & Tracking"
          icon={DollarSign}
          action={<Link className="text-xs font-black text-orange-400 hover:text-orange-300" href="/invoices">Open Invoices →</Link>}
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-[#0c172b] p-3">
              <p className="text-xs font-bold text-slate-500">Unpaid</p>
              <p className="text-2xl font-black text-white">{String(metrics.unpaidInvoices ?? 0)}</p>
            </div>
            <div className="rounded-lg bg-[#0c172b] p-3">
              <p className="text-xs font-bold text-slate-500">Overdue</p>
              <p className="text-2xl font-black text-red-300">{String(metrics.overdueInvoices ?? 0)}</p>
            </div>
            <div className="rounded-lg bg-[#0c172b] p-3">
              <p className="text-xs font-bold text-slate-500">Ready</p>
              <p className="text-2xl font-black text-orange-300">{String(metrics.readyToInvoice ?? 0)}</p>
            </div>
          </div>
          <div className="grid gap-3">
            {invoiceAttention.slice(0, 4).map((row) => (
              <Link className="flex items-center justify-between rounded-lg border border-[#223758] bg-[#0c172b] p-3" href={`/invoices/${String(row.id)}`} key={String(row.id)}>
                <span className="font-black text-white">{displayValue(row, "invoice_number")}</span>
                <span className="text-sm font-bold text-slate-400">{money(row.balance_due)}</span>
              </Link>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel title="Automation Feed" icon={Inbox}>
          <div className="grid gap-3 text-sm">
            {[
              "Connect Gmail + mHelpDesk in Settings, then open Job Intake for assignment parsing.",
              "Gemini extracts store #, WO #, DNE, location, and timeframe into clean job briefs.",
              "Approve outbound email drafts before send, or stage mHelpDesk field-mapped updates.",
            ].map((item) => (
              <div className="rounded-lg border border-[#223758] bg-[#0c172b] p-3 text-slate-300" key={item}>{item}</div>
            ))}
          </div>
        </DashboardPanel>
      </section>
    </div>
  );
}
