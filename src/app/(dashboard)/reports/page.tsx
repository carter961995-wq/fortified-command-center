import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/constants";

async function getReportData() {
  const supabase = await createClient();

  const [
    { count: customerCount },
    { count: woCount },
    { count: openWoCount },
    { data: invoiceData },
    { data: paymentData },
    { data: jobCostData },
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("work_orders").select("*", { count: "exact", head: true }),
    supabase.from("work_orders").select("*", { count: "exact", head: true }).not("status", "in", '("Closed","Cancelled","Paid")'),
    supabase.from("invoices").select("total, status"),
    supabase.from("payments").select("amount"),
    supabase.from("job_costs").select("amount"),
  ]);

  const totalInvoiced = (invoiceData ?? []).reduce((sum, inv) => sum + Number(inv.total), 0);
  const totalPaid = (paymentData ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const totalCosts = (jobCostData ?? []).reduce((sum, jc) => sum + Number(jc.amount), 0);
  const outstandingAR = totalInvoiced - totalPaid;
  const grossProfit = totalInvoiced - totalCosts;
  const grossMargin = totalInvoiced > 0 ? (grossProfit / totalInvoiced) * 100 : 0;

  return {
    customerCount: customerCount ?? 0,
    totalWorkOrders: woCount ?? 0,
    openWorkOrders: openWoCount ?? 0,
    totalInvoiced,
    totalPaid,
    totalCosts,
    outstandingAR,
    grossProfit,
    grossMargin,
  };
}

export default async function ReportsPage() {
  let data;
  let error: string | null = null;
  try {
    data = await getReportData();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load report data";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Business performance overview" />

      {error ? (
        <Card><CardContent className="p-6 text-muted-foreground">{error}</CardContent></Card>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Customers</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{data.customerCount}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Work Orders</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{data.totalWorkOrders}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Open Work Orders</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{data.openWorkOrders}</p></CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Invoiced</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{formatCurrency(data.totalInvoiced)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Collected</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold text-green-600">{formatCurrency(data.totalPaid)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Outstanding AR</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold text-amber-600">{formatCurrency(data.outstandingAR)}</p></CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Job Costs</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{formatCurrency(data.totalCosts)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Gross Profit</CardTitle></CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${data.grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(data.grossProfit)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Gross Margin</CardTitle></CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${data.grossMargin >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {data.grossMargin.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
