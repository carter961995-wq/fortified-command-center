import Link from "next/link";
import {
  ArrowRight,
  ClipboardPlus,
  Inbox,
  Mail,
  RadioTower,
  Receipt,
  Workflow,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { WorkOrderStatusBadge } from "@/components/status-badges";
import type { DashboardInvoice, DashboardMetrics, DashboardWorkOrder } from "@/components/premium-dashboard";
import { unwrapEmbed } from "@/lib/unwrap-embed";

export type SourceStatus = {
  connected: boolean;
  email?: string | null;
  lastSyncAt?: string | null;
};

function customerName(row: { customers?: unknown }) {
  return unwrapEmbed<{ company_name?: string }>(row.customers)?.company_name ?? "Unassigned";
}

function QueueCard({
  href,
  label,
  count,
  detail,
}: {
  href: string;
  label: string;
  count: number;
  detail: string;
}) {
  return (
    <Link href={href} className="queue-card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold uppercase tracking-wide text-orange-200">{label}</p>
        <ArrowRight className="size-4 text-slate-300" />
      </div>
      <p className="mt-3 text-4xl font-black tabular-nums text-white">{count}</p>
      <p className="mt-2 text-sm text-slate-200">{detail}</p>
      <p className="mt-4 text-sm font-bold text-orange-300">Open queue</p>
    </Link>
  );
}

function SourceCard({
  href,
  name,
  detail,
  status,
  icon: Icon,
}: {
  href: string;
  name: string;
  detail: string;
  status: SourceStatus;
  icon: typeof Mail;
}) {
  return (
    <Link href={href} className="source-card">
      <span className="flex size-11 items-center justify-center rounded-lg bg-slate-950 text-orange-300">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-white">{name}</h3>
          <span className={status.connected ? "status-pill status-pill-on" : "status-pill status-pill-off"}>
            {status.connected ? "Connected" : "Not set up"}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-200">{status.connected ? status.email || detail : detail}</p>
      </div>
      <span className="app-btn app-btn-secondary shrink-0">{status.connected ? "Manage" : "Set up"}</span>
    </Link>
  );
}

export function CommandDashboard({
  metrics,
  recentWorkOrders,
  scheduledWorkOrders,
  attentionInvoices,
  sources,
}: {
  metrics: DashboardMetrics;
  recentWorkOrders: DashboardWorkOrder[];
  scheduledWorkOrders: DashboardWorkOrder[];
  attentionInvoices: DashboardInvoice[];
  sources: {
    mhelpdesk: SourceStatus;
    truesource: SourceStatus;
    gmail: SourceStatus;
  };
}) {
  const quoteDesk = metrics.needQuotes + metrics.waitingOnSubQuote;

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">Fortified Command Center</p>
          <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">Run the shop from here</h1>
          <p className="mt-2 max-w-2xl text-base text-slate-200">
            Select a source, pull jobs, then work the board. This is the app — mHelpDesk and TrueSource are just inboxes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/work-orders/new" className="app-btn app-btn-primary">
            <ClipboardPlus className="size-4" />
            New work order
          </Link>
          <Link href="/job-intake" className="app-btn app-btn-secondary">
            <Inbox className="size-4" />
            Job Intake
          </Link>
          <Link href="/invoices" className="app-btn app-btn-secondary">
            <Receipt className="size-4" />
            Invoices
          </Link>
        </div>
      </header>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-white">Job sources</h2>
          <Link href="/job-sources" className="text-sm font-bold text-orange-300 hover:text-orange-200">
            Open setup
          </Link>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <SourceCard
            href="/job-sources"
            name="mHelpDesk"
            detail="Connect the account that emails you new facility jobs."
            status={sources.mhelpdesk}
            icon={Workflow}
          />
          <SourceCard
            href="/job-sources"
            name="TrueSource"
            detail="Affiliate Connect assignments from national accounts."
            status={sources.truesource}
            icon={RadioTower}
          />
          <SourceCard
            href="/job-sources"
            name="Gmail"
            detail="Required for email-bridge imports and approve-before-send."
            status={sources.gmail}
            icon={Mail}
          />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <QueueCard
          href="/job-intake"
          label="Incoming"
          count={metrics.openWorkOrders}
          detail="Open work plus intake that still needs a decision."
        />
        <QueueCard
          href="/work-orders?status=Quote%20Needed"
          label="Quote desk"
          count={quoteDesk}
          detail="Needs site info, a quote, or a sub number."
        />
        <QueueCard
          href="/work-orders?status=Scheduled"
          label="In the field"
          count={metrics.productionWorkOrders}
          detail="Approved, scheduled, or in progress."
        />
        <QueueCard
          href="/work-orders?status=Ready%20to%20Invoice"
          label="Bill it"
          count={metrics.readyToInvoice + metrics.unpaidInvoices}
          detail={`${metrics.readyToInvoice} ready · ${metrics.unpaidInvoices} unpaid`}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel">
          <div className="flex items-center justify-between gap-3 border-b border-slate-600 px-5 py-4">
            <h2 className="font-black text-white">Select a job</h2>
            <Link href="/work-orders" className="text-sm font-bold text-orange-300">
              All work orders
            </Link>
          </div>
          <div className="divide-y divide-slate-700">
            {recentWorkOrders.length ? (
              recentWorkOrders.slice(0, 8).map((row) => (
                <Link key={row.id} href={`/work-orders/${row.id}`} className="job-row">
                  <div className="min-w-0">
                    <p className="font-bold text-white">
                      {row.work_order_number ?? "WO"} · {row.title ?? "Untitled"}
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      {customerName(row)}
                      {row.scheduled_date ? ` · ${formatDate(row.scheduled_date)}` : ""}
                    </p>
                  </div>
                  <WorkOrderStatusBadge status={row.status ?? "New"} />
                </Link>
              ))
            ) : (
              <div className="px-5 py-8 text-sm text-slate-200">
                No work orders yet.{" "}
                <Link className="font-bold text-orange-300" href="/job-intake">
                  Pull jobs
                </Link>{" "}
                or{" "}
                <Link className="font-bold text-orange-300" href="/work-orders/new">
                  create one
                </Link>
                .
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-5">
          <div className="panel">
            <div className="border-b border-slate-600 px-5 py-4">
              <h2 className="font-black text-white">Today / next up</h2>
            </div>
            <div className="divide-y divide-slate-700">
              {scheduledWorkOrders.length ? (
                scheduledWorkOrders.slice(0, 5).map((row) => (
                  <Link key={row.id} href={`/work-orders/${row.id}`} className="job-row">
                    <div>
                      <p className="font-bold text-white">{row.title ?? row.work_order_number}</p>
                      <p className="mt-1 text-sm text-slate-200">{formatDate(row.scheduled_date)}</p>
                    </div>
                    <span className="text-sm font-bold text-orange-300">Open</span>
                  </Link>
                ))
              ) : (
                <p className="px-5 py-8 text-sm text-slate-200">Nothing scheduled. Grab a job from incoming.</p>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="flex items-center justify-between border-b border-slate-600 px-5 py-4">
              <h2 className="font-black text-white">Money</h2>
              <Link href="/invoices" className="text-sm font-bold text-orange-300">
                Open AR
              </Link>
            </div>
            <div className="grid gap-3 p-5">
              <div className="rounded-lg bg-slate-950 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">MTD revenue</p>
                <p className="mt-1 text-2xl font-black text-white">{formatCurrency(metrics.revenueMonth)}</p>
              </div>
              {attentionInvoices.slice(0, 3).map((row) => (
                <Link key={row.id} href={`/invoices/${row.id}`} className="job-row rounded-lg border border-slate-600 px-3">
                  <span className="font-bold text-white">{row.invoice_number ?? "Invoice"}</span>
                  <span className="font-bold text-orange-200">{formatCurrency(row.balance_due)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
