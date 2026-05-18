import { Card, ErrorNotice, PageHeader } from "../../../components/ui";
import { displayValue, money, percent } from "../../../lib/business";
import { fetchReports } from "../../../lib/data";

function monthKey(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unscheduled";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMetric(map: Map<string, { revenue: number; cost: number; count: number }>, key: string, revenue = 0, cost = 0, count = 0) {
  const current = map.get(key) ?? { revenue: 0, cost: 0, count: 0 };
  current.revenue += revenue;
  current.cost += cost;
  current.count += count;
  map.set(key, current);
}

function MetricTable({ title, rows }: { title: string; rows: { label: string; revenue?: number; cost?: number; count?: number }[] }) {
  return (
    <Card>
      <h2 className="mb-4 text-lg font-black">{title}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm"><thead className="text-left text-xs uppercase tracking-wide text-stone-500"><tr><th className="border-b px-3 py-2">Group</th><th className="border-b px-3 py-2">Revenue</th><th className="border-b px-3 py-2">Profit</th><th className="border-b px-3 py-2">Margin</th><th className="border-b px-3 py-2">Count</th></tr></thead><tbody>{rows.map((row) => { const revenue = row.revenue ?? 0; const cost = row.cost ?? 0; const profit = revenue - cost; return <tr key={row.label}><td className="border-b border-stone-100 px-3 py-2 font-bold">{row.label}</td><td className="border-b border-stone-100 px-3 py-2">{money(revenue)}</td><td className="border-b border-stone-100 px-3 py-2">{money(profit)}</td><td className="border-b border-stone-100 px-3 py-2">{percent(revenue > 0 ? (profit / revenue) * 100 : 0)}</td><td className="border-b border-stone-100 px-3 py-2">{row.count ?? 0}</td></tr>; })}</tbody></table>
      </div>
    </Card>
  );
}

export default async function ReportsPage() {
  const { invoices, costs, workOrders, subcontractors, error } = await fetchReports();
  const costByWorkOrder = new Map<string, number>();
  costs.forEach((cost) => costByWorkOrder.set(String(cost.work_order_id), (costByWorkOrder.get(String(cost.work_order_id)) ?? 0) + Number(cost.amount ?? 0)));

  const byMonth = new Map<string, { revenue: number; cost: number; count: number }>();
  const byCustomer = new Map<string, { revenue: number; cost: number; count: number }>();
  const byState = new Map<string, { revenue: number; cost: number; count: number }>();
  const bySub = new Map<string, { revenue: number; cost: number; count: number }>();

  invoices.forEach((invoice) => {
    const revenue = Number(invoice.total_amount ?? 0);
    const woId = String(invoice.work_order_id ?? "");
    const cost = costByWorkOrder.get(woId) ?? 0;
    addMetric(byMonth, monthKey(invoice.invoice_date), revenue, cost, 1);
    addMetric(byCustomer, displayValue(invoice, "customers.company_name"), revenue, cost, 1);
    addMetric(byState, displayValue(invoice, "locations.state"), revenue, cost, 1);
  });
  workOrders.forEach((wo) => addMetric(bySub, displayValue(wo, "subcontractors.company_name"), 0, costByWorkOrder.get(String(wo.id)) ?? 0, wo.status === "Closed" || wo.status === "Paid" ? 1 : 0));

  const tableRows = (map: Map<string, { revenue: number; cost: number; count: number }>) => Array.from(map.entries()).map(([label, value]) => ({ label, ...value })).sort((a, b) => b.revenue - a.revenue);
  const aging = invoices.filter((invoice) => Number(invoice.balance_due ?? 0) > 0).map((invoice) => ({ label: `${displayValue(invoice, "invoice_number")} · ${displayValue(invoice, "customers.company_name")}`, revenue: Number(invoice.balance_due ?? 0), cost: 0, count: 1 }));
  const callbacks = subcontractors.map((sub) => ({ label: displayValue(sub, "company_name"), revenue: 0, cost: Number(sub.callback_count ?? 0), count: Number(sub.jobs_completed ?? 0) }));

  return (
    <div className="grid gap-6">
      <PageHeader title="Reports" description="Revenue, profit, margin, open invoice, aging, subcontractor production, and callback visibility for commercial operations." />
      <ErrorNotice message={error} />
      <section className="grid gap-6 xl:grid-cols-2">
        <MetricTable title="Revenue / gross profit by month" rows={tableRows(byMonth)} />
        <MetricTable title="Revenue / profit by customer" rows={tableRows(byCustomer)} />
        <MetricTable title="Revenue / profit by state" rows={tableRows(byState)} />
        <MetricTable title="Profit by subcontractor" rows={tableRows(bySub)} />
        <MetricTable title="Open invoices / aging" rows={aging} />
        <MetricTable title="Callbacks and jobs completed by subcontractor" rows={callbacks} />
      </section>
    </div>
  );
}
