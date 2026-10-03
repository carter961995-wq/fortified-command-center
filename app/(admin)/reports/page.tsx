import { Card, ErrorNotice, PageHeader } from "../../../components/ui";
import { money, percent } from "../../../lib/business";
import { fetchReports, type ReportRow } from "../../../lib/data";

function MetricTable({ title, rows }: { title: string; rows: ReportRow[] }) {
  return (
    <Card>
      <h2 className="mb-4 text-lg font-black">{title}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="border-b px-3 py-2">Group</th>
              <th className="border-b px-3 py-2">Revenue</th>
              <th className="border-b px-3 py-2">Profit</th>
              <th className="border-b px-3 py-2">Margin</th>
              <th className="border-b px-3 py-2">Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-3 py-3 text-stone-500" colSpan={5}>No qualifying records yet.</td></tr>
            ) : rows.map((row) => {
              const profit = row.revenue - row.cost;
              return (
                <tr key={row.label}>
                  <td className="border-b border-stone-100 px-3 py-2 font-bold">{row.label}</td>
                  <td className="border-b border-stone-100 px-3 py-2">{money(row.revenue)}</td>
                  <td className="border-b border-stone-100 px-3 py-2">{money(profit)}</td>
                  <td className="border-b border-stone-100 px-3 py-2">{percent(row.revenue > 0 ? (profit / row.revenue) * 100 : 0)}</td>
                  <td className="border-b border-stone-100 px-3 py-2">{row.count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default async function ReportsPage() {
  const { byMonth, byCustomer, byState, bySub, aging, callbacks, error } = await fetchReports();
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader title="Reports" description="Revenue, profit, margin, open invoice, aging, subcontractor production, and callback totals include every qualifying record." />
      <ErrorNotice message={error} />
      <section className="grid min-w-0 gap-6 xl:grid-cols-2">
        <MetricTable title="Revenue / gross profit by month" rows={byMonth} />
        <MetricTable title="Revenue / profit by customer" rows={byCustomer} />
        <MetricTable title="Revenue / profit by state" rows={byState} />
        <MetricTable title="Profit by subcontractor" rows={bySub} />
        <MetricTable title="Open invoices / aging" rows={aging} />
        <MetricTable title="Callbacks and jobs completed by subcontractor" rows={callbacks} />
      </section>
    </div>
  );
}
