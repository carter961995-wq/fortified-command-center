import { Suspense } from "react";
import Link from "next/link";
import { requireStaff } from "@/lib/require-staff";
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
import { WorkOrderStatusBadge, InvoiceStatusBadge } from "@/components/status-badges";
import { endOfMonth, format, startOfMonth } from "date-fns";

export const metadata = {
  title: "Dashboard",
};

async function DashboardContent() {
  const { supabase } = await requireStaff();

  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const [
    openWo,
    needQuotes,
    waitSub,
    readyInv,
    unpaidInv,
    overdueInv,
    monthInvoices,
    activeSubs,
    activeContracts,
    recentWo,
    scheduledWo,
    attentionInvoices,
  ] = await Promise.all([
    supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .not("status", "eq", "Closed")
      .not("status", "eq", "Cancelled"),
    supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["Quote Needed", "Needs Site Info"]),
    supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "Waiting on Sub Quote"),
    supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "Ready to Invoice"),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .in("status", ["sent", "partially_paid", "overdue"]),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .lt("due_date", today)
      .gt("balance_due", 0)
      .not("status", "eq", "paid")
      .not("status", "eq", "void")
      .not("status", "eq", "draft"),
    supabase
      .from("invoices")
      .select("work_order_id, total_amount, status")
      .gte("invoice_date", monthStart)
      .lte("invoice_date", monthEnd)
      .not("status", "eq", "void")
      .not("status", "eq", "draft"),
    supabase.from("subcontractors").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("maintenance_contracts").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("work_orders")
      .select(
        "id, work_order_number, title, status, priority, scheduled_date, customers(company_name), locations(city, state)"
      )
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("work_orders")
      .select(
        "id, work_order_number, title, status, scheduled_date, customers(company_name), locations(city, state)"
      )
      .not("scheduled_date", "is", null)
      .gte("scheduled_date", today)
      .order("scheduled_date", { ascending: true })
      .limit(12),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, status, total_amount, balance_due, due_date, customers(company_name)"
      )
      .gt("balance_due", 0)
      .not("status", "eq", "paid")
      .not("status", "eq", "void")
      .not("status", "eq", "draft")
      .order("due_date", { ascending: true })
      .limit(12),
  ]);

  const woIds = Array.from(
    new Set((monthInvoices.data ?? []).map((i) => i.work_order_id).filter(Boolean))
  ) as string[];

  let revenueMonth = 0;
  let grossProfitMonth = 0;
  if (woIds.length) {
    const { data: fin } = await supabase.from("work_order_financials").select("*").in("work_order_id", woIds);
    const finByWo = new Map((fin ?? []).map((f) => [f.work_order_id, f]));
    const profitCounted = new Set<string>();
    for (const inv of monthInvoices.data ?? []) {
      if (inv.status === "void") continue;
      revenueMonth += Number(inv.total_amount ?? 0);
      const woid = inv.work_order_id as string | null;
      if (!woid || profitCounted.has(woid)) continue;
      profitCounted.add(woid);
      grossProfitMonth += Number(finByWo.get(woid)?.gross_profit ?? 0);
    }
  }

  const margin =
    revenueMonth > 0 ? Math.round((grossProfitMonth / revenueMonth) * 10000) / 100 : 0;

  const stat = (label: string, value: string | number, hint?: string) => (
    <Card size="sm">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Operational snapshot for commercial fence, gate, and welding work across your network.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stat("Open work orders", openWo.count ?? 0, "Excludes closed / cancelled")}
        {stat("Jobs needing quotes", needQuotes.count ?? 0, "Quote needed or site info")}
        {stat("Waiting on sub quote", waitSub.count ?? 0)}
        {stat("Ready to invoice", readyInv.count ?? 0)}
        {stat("Unpaid invoices", unpaidInv.count ?? 0, "Sent, partial, overdue")}
        {stat("Overdue / past due", overdueInv.count ?? 0)}
        {stat("Revenue (MTD)", formatCurrency(revenueMonth), `${monthStart} – ${monthEnd}`)}
        {stat("Gross profit (MTD)", formatCurrency(grossProfitMonth))}
        {stat("Gross margin (MTD)", `${margin}%`, "Based on linked work order P&L")}
        {stat("Active subcontractors", activeSubs.count ?? 0)}
        {stat("Active maintenance", activeContracts.count ?? 0)}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent work orders</CardTitle>
            <CardDescription>Newest activity across the network.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>WO</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentWo.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No work orders yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (recentWo.data ?? []).map((row) => {
                    const custRaw = row.customers as { company_name: string } | { company_name: string }[] | null;
                    const c = Array.isArray(custRaw) ? custRaw[0] : custRaw;
                    const locRaw = row.locations as { city: string; state: string } | { city: string; state: string }[] | null;
                    const l = Array.isArray(locRaw) ? locRaw[0] : locRaw;
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Link href={`/work-orders/${row.id}`} className="font-medium text-primary hover:underline">
                            {row.work_order_number}
                          </Link>
                          <div className="text-xs text-muted-foreground">{row.title}</div>
                        </TableCell>
                        <TableCell>{c?.company_name ?? "—"}</TableCell>
                        <TableCell>
                          {l ? `${l.city}, ${l.state}` : "—"}
                        </TableCell>
                        <TableCell>
                          <WorkOrderStatusBadge status={row.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming scheduled jobs</CardTitle>
            <CardDescription>Next field dates on the calendar.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>WO</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(scheduledWo.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No upcoming schedules.
                    </TableCell>
                  </TableRow>
                ) : (
                  (scheduledWo.data ?? []).map((row) => {
                    const custRaw = row.customers as { company_name: string } | { company_name: string }[] | null;
                    const c = Array.isArray(custRaw) ? custRaw[0] : custRaw;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">
                          {row.scheduled_date ? formatDate(row.scheduled_date) : "—"}
                        </TableCell>
                        <TableCell>
                          <Link href={`/work-orders/${row.id}`} className="font-medium text-primary hover:underline">
                            {row.work_order_number}
                          </Link>
                        </TableCell>
                        <TableCell>{c?.company_name ?? "—"}</TableCell>
                        <TableCell>
                          <WorkOrderStatusBadge status={row.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices needing attention</CardTitle>
          <CardDescription>Overdue, partial payments, or past due while still open.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(attentionInvoices.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No invoices in follow-up status.
                  </TableCell>
                </TableRow>
              ) : (
                (attentionInvoices.data ?? []).map((row) => {
                  const custRaw = row.customers as { company_name: string } | { company_name: string }[] | null;
                  const cust = Array.isArray(custRaw) ? custRaw[0] : custRaw;
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link href={`/invoices/${row.id}`} className="font-medium text-primary hover:underline">
                          {row.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>{cust?.company_name ?? "—"}</TableCell>
                      <TableCell>{formatCurrency(row.balance_due)}</TableCell>
                      <TableCell>{row.due_date ? formatDate(row.due_date) : "—"}</TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={row.status} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading dashboard…</div>}>
      <DashboardContent />
    </Suspense>
  );
}
