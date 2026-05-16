import { requireStaff } from "@/lib/require-staff";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { subMonths, format, startOfMonth } from "date-fns";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { supabase } = await requireStaff();
  const since = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, total_amount, invoice_date, due_date, status, balance_due, customer_id, work_order_id, customers(company_name)")
    .gte("invoice_date", since)
    .not("status", "eq", "void");

  const { data: financials } = await supabase.from("work_order_financials").select("*");
  const finByWo = new Map((financials ?? []).map((f) => [f.work_order_id as string, f]));

  const { data: workOrders } = await supabase
    .from("work_orders")
    .select("id, location_id, locations(state)")
    .limit(5000);

  const stateByWo = new Map<string, string>();
  for (const w of workOrders ?? []) {
    const l = unwrapEmbed<{ state: string }>(w.locations);
    if (l?.state) stateByWo.set(w.id, l.state);
  }

  const revenueByMonth = new Map<string, number>();
  const profitByMonth = new Map<string, number>();
  const revenueByCustomer = new Map<string, number>();
  const profitByCustomer = new Map<string, number>();
  const revenueByState = new Map<string, number>();
  const profitByState = new Map<string, number>();

  for (const inv of invoices ?? []) {
    if (!inv.invoice_date || inv.status === "draft") continue;
    const month = inv.invoice_date.slice(0, 7);
    const amt = Number(inv.total_amount ?? 0);
    revenueByMonth.set(month, (revenueByMonth.get(month) ?? 0) + amt);

    const c = unwrapEmbed<{ company_name: string }>(inv.customers);
    const cn = c?.company_name ?? "Unknown";
    revenueByCustomer.set(cn, (revenueByCustomer.get(cn) ?? 0) + amt);

    const f = inv.work_order_id ? finByWo.get(inv.work_order_id) : undefined;
    const gp = Number(f?.gross_profit ?? 0);
    if (inv.work_order_id && f) {
      profitByMonth.set(month, (profitByMonth.get(month) ?? 0) + gp);
      profitByCustomer.set(cn, (profitByCustomer.get(cn) ?? 0) + gp);
      const st = stateByWo.get(inv.work_order_id) ?? "UNK";
      profitByState.set(st, (profitByState.get(st) ?? 0) + gp);
      revenueByState.set(st, (revenueByState.get(st) ?? 0) + amt);
    }
  }

  const monthRows = Array.from(revenueByMonth.keys())
    .sort()
    .map((m) => {
      const rev = revenueByMonth.get(m) ?? 0;
      const prof = profitByMonth.get(m) ?? 0;
      const margin = rev > 0 ? Math.round((prof / rev) * 10000) / 100 : 0;
      return { m, rev, prof, margin };
    });

  const openInvoices =
    invoices?.filter((i) => ["sent", "partially_paid", "overdue"].includes(i.status) && Number(i.balance_due) > 0) ?? [];

  const { data: jc } = await supabase
    .from("job_costs")
    .select("amount, subcontractors(company_name)")
    .not("subcontractor_id", "is", null);

  const costBySub = new Map<string, number>();
  for (const row of jc ?? []) {
    const s = unwrapEmbed<{ company_name: string }>(row.subcontractors);
    const name = s?.company_name ?? "Unknown";
    costBySub.set(name, (costBySub.get(name) ?? 0) + Number(row.amount ?? 0));
  }

  const { data: subRows } = await supabase
    .from("subcontractors")
    .select("company_name, jobs_completed, callback_count, quality_score")
    .order("company_name");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Rolling twelve-month invoice view with P&amp;L from work order financials.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue, gross profit, and margin by month</CardTitle>
          <CardDescription>Profit sums the gross profit snapshot per invoiced work order in that month.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Gross profit</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthRows.map((r) => (
                <TableRow key={r.m}>
                  <TableCell>{r.m}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.rev)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.prof)}</TableCell>
                  <TableCell className="text-right">{r.margin}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by customer</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableBody>
                {Array.from(revenueByCustomer.entries())
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 20)
                  .map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell>{k}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(v)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gross profit by customer</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableBody>
                {Array.from(profitByCustomer.entries())
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 20)
                  .map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell>{k}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(v)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by state</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableBody>
                {Array.from(revenueByState.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell>{k}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(v)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gross profit by state</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableBody>
                {Array.from(profitByState.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell>{k}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(v)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job costs recorded by subcontractor</CardTitle>
          <CardDescription>Sum of job_costs lines with a subcontractor assigned.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subcontractor</TableHead>
                <TableHead className="text-right">Costs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(costBySub.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <TableRow key={k}>
                    <TableCell>{k}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(v)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Open invoices</CardTitle>
          <CardDescription>Sent, partial, or overdue with a positive balance.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openInvoices.map((i) => {
                const c = unwrapEmbed<{ company_name: string }>(i.customers);
                return (
                  <TableRow key={i.id}>
                    <TableCell>{c?.company_name ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(i.balance_due)}</TableCell>
                    <TableCell>{i.due_date ? formatDate(i.due_date) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subcontractor scorecard</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead className="text-right">Jobs</TableHead>
                <TableHead className="text-right">Callbacks</TableHead>
                <TableHead className="text-right">Quality</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(subRows ?? []).map((s) => (
                <TableRow key={s.company_name}>
                  <TableCell>{s.company_name}</TableCell>
                  <TableCell className="text-right">{s.jobs_completed}</TableCell>
                  <TableCell className="text-right">{s.callback_count}</TableCell>
                  <TableCell className="text-right">{s.quality_score ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
