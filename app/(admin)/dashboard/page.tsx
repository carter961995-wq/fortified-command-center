import Link from "next/link";
import { Card, ErrorNotice, KeyValue, PageHeader, Badge } from "@/components/ui";
import { fetchDashboardMetrics } from "@/lib/data";
import { displayValue, formatDate, money, percent, type PlainRow } from "@/lib/business";

function WorkOrderList({ title, rows }: { title: string; rows: PlainRow[] }) {
  return (
    <Card>
      <h2 className="mb-4 text-lg font-black">{title}</h2>
      <div className="grid gap-3">
        {rows.length ? rows.map((row) => (
          <Link className="rounded-xl border border-stone-200 bg-stone-50 p-3 hover:bg-amber-50" href={`/work-orders/${String(row.id)}`} key={String(row.id)}>
            <div className="flex items-start justify-between gap-3"><p className="font-black">{displayValue(row, "work_order_number")} · {displayValue(row, "title")}</p><Badge>{displayValue(row, "status")}</Badge></div>
            <p className="mt-1 text-sm text-stone-600">Due {formatDate(row.due_date)} · Scheduled {formatDate(row.scheduled_date)}</p>
          </Link>
        )) : <p className="text-sm text-stone-500">No records needing attention.</p>}
      </div>
    </Card>
  );
}

function InvoiceList({ rows }: { rows: PlainRow[] }) {
  return (
    <Card>
      <h2 className="mb-4 text-lg font-black">Invoices needing attention</h2>
      <div className="grid gap-3">
        {rows.length ? rows.map((row) => (
          <Link className="rounded-xl border border-stone-200 bg-stone-50 p-3 hover:bg-amber-50" href={`/invoices/${String(row.id)}`} key={String(row.id)}>
            <div className="flex items-start justify-between gap-3"><p className="font-black">{displayValue(row, "invoice_number")}</p><Badge>{displayValue(row, "status")}</Badge></div>
            <p className="mt-1 text-sm text-stone-600">Balance {money(row.balance_due)} · Due {formatDate(row.due_date)}</p>
          </Link>
        )) : <p className="text-sm text-stone-500">No open invoice issues.</p>}
      </div>
    </Card>
  );
}

export default async function DashboardPage() {
  const { metrics, recentWorkOrders, upcomingJobs, invoiceAttention, error } = await fetchDashboardMetrics();
  return (
    <div className="grid gap-6">
      <PageHeader title="Dashboard" description="Operational command view for dispatch, quoting, invoicing, payments, job cost, vendor readiness, and recurring maintenance." />
      <ErrorNotice message={error} />
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <KeyValue label="Open work orders" value={String(metrics.openWorkOrders ?? 0)} />
        <KeyValue label="Jobs needing quotes" value={String(metrics.jobsNeedingQuotes ?? 0)} />
        <KeyValue label="Waiting on sub quote" value={String(metrics.waitingOnSubQuote ?? 0)} />
        <KeyValue label="Ready to invoice" value={String(metrics.readyToInvoice ?? 0)} />
        <KeyValue label="Unpaid invoices" value={String(metrics.unpaidInvoices ?? 0)} />
        <KeyValue label="Overdue invoices" value={String(metrics.overdueInvoices ?? 0)} />
        <KeyValue label="Revenue this month" value={money(metrics.revenueThisMonth)} />
        <KeyValue label="Gross profit this month" value={money(metrics.grossProfitThisMonth)} />
        <KeyValue label="Gross margin this month" value={percent(metrics.grossMarginThisMonth)} />
        <KeyValue label="Active subcontractors" value={String(metrics.activeSubcontractors ?? 0)} />
        <KeyValue label="Active maintenance" value={String(metrics.activeMaintenanceContracts ?? 0)} />
      </section>
      <section className="grid gap-6 xl:grid-cols-3">
        <WorkOrderList title="Recent work orders" rows={recentWorkOrders} />
        <WorkOrderList title="Upcoming scheduled jobs" rows={upcomingJobs} />
        <InvoiceList rows={invoiceAttention} />
      </section>
    </div>
  );
}
