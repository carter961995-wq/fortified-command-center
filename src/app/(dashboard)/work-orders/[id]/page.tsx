import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getWorkOrder } from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Edit, Plus, FileText, Receipt } from "lucide-react";
import {
  getStatusColor,
  getPriorityColor,
  formatDate,
  formatCurrency,
  calculateProfitMetrics,
} from "@/lib/constants";
import type { WorkOrderStatus, Priority } from "@/lib/types/database";
import { WorkOrderStatusUpdater } from "@/components/work-orders/status-updater";

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let wo;
  try {
    wo = await getWorkOrder(id);
  } catch {
    notFound();
  }

  const jobCosts = (wo.job_costs as { id: string; category: string; description: string; amount: number; date: string }[]) ?? [];
  const totalJobCosts = jobCosts.reduce((sum, jc) => sum + Number(jc.amount), 0);

  const invoices = (wo.invoices as { id: string; invoice_number: string; total: number; status: string; invoice_date: string }[]) ?? [];
  const invoiceTotal = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);

  const profitMetrics = calculateProfitMetrics(invoiceTotal, totalJobCosts);
  const quotes = (wo.quotes as { id: string; quote_number: string; total: number; status: string }[]) ?? [];
  const customer = wo.customer as { company_name: string; contact_name: string; phone: string } | null;
  const location = wo.location as { name: string; city: string; state: string; address_line1: string } | null;
  const sub = wo.subcontractor as { company_name: string; phone: string } | null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={wo.title}
        description={`${customer?.company_name ?? ""} — ${location?.name ?? ""}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/work-orders">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/work-orders/${wo.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge className={getStatusColor(wo.status as WorkOrderStatus)}>{wo.status}</Badge>
        <Badge className={getPriorityColor(wo.priority as Priority)}>{wo.priority}</Badge>
        <Badge variant="outline">{wo.trade_type}</Badge>
        {wo.customer_wo_number && <Badge variant="secondary">WO# {wo.customer_wo_number}</Badge>}
        {wo.purchase_order_number && <Badge variant="secondary">PO# {wo.purchase_order_number}</Badge>}
      </div>

      <WorkOrderStatusUpdater workOrderId={wo.id} currentStatus={wo.status} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Customer</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{customer?.company_name ?? "—"}</p>
            <p>{customer?.contact_name}</p>
            <p>{customer?.phone}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Location</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{location?.name ?? "—"}</p>
            <p>{location?.address_line1}</p>
            <p>{location?.city}, {location?.state}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Subcontractor</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {sub ? (
              <>
                <p className="font-medium">{sub.company_name}</p>
                <p>{sub.phone}</p>
              </>
            ) : (
              <p className="text-muted-foreground">Not assigned</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">NTE</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{wo.nte_amount ? formatCurrency(wo.nte_amount) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Invoice Total</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(profitMetrics.invoice_total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Job Costs</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(profitMetrics.total_job_costs)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Gross Profit</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${profitMetrics.gross_profit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(profitMetrics.gross_profit)}{" "}
              <span className="text-sm font-normal">({profitMetrics.gross_margin.toFixed(1)}%)</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Dates</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between"><span>Requested:</span><span>{formatDate(wo.requested_date)}</span></div>
            <div className="flex justify-between"><span>Due:</span><span>{formatDate(wo.due_date)}</span></div>
            <div className="flex justify-between"><span>Scheduled:</span><span>{formatDate(wo.scheduled_date)}</span></div>
            <div className="flex justify-between"><span>Completed:</span><span>{formatDate(wo.completed_date)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Scope Summary</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{wo.scope_summary || "No scope summary provided."}</p>
          </CardContent>
        </Card>
      </div>

      {(wo.customer_notes || wo.internal_notes) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {wo.customer_notes && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Customer Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{wo.customer_notes}</p></CardContent>
            </Card>
          )}
          {wo.internal_notes && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Internal Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{wo.internal_notes}</p></CardContent>
            </Card>
          )}
        </div>
      )}

      <Separator />

      {/* Job Costs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Job Costs</CardTitle>
          <Button size="sm" asChild>
            <Link href={`/job-costs/new?work_order_id=${wo.id}`}>
              <Plus className="mr-1 h-3 w-3" /> Add Cost
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {jobCosts.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No job costs recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobCosts.map((jc) => (
                  <TableRow key={jc.id}>
                    <TableCell><Badge variant="outline">{jc.category}</Badge></TableCell>
                    <TableCell>{jc.description}</TableCell>
                    <TableCell>{formatDate(jc.date)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(jc.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold">
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalJobCosts)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quotes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Quotes</CardTitle>
          <Button size="sm" asChild>
            <Link href={`/quotes/new?work_order_id=${wo.id}`}>
              <FileText className="mr-1 h-3 w-3" /> Create Quote
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {quotes.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No quotes created yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <Link href={`/quotes/${q.id}`} className="text-blue-600 hover:underline">{q.quote_number}</Link>
                    </TableCell>
                    <TableCell>{formatCurrency(q.total)}</TableCell>
                    <TableCell><Badge variant="outline">{q.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Invoices</CardTitle>
          <Button size="sm" asChild>
            <Link href={`/invoices/new?work_order_id=${wo.id}`}>
              <Receipt className="mr-1 h-3 w-3" /> Create Invoice
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No invoices created yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link href={`/invoices/${inv.id}`} className="text-blue-600 hover:underline">{inv.invoice_number}</Link>
                    </TableCell>
                    <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                    <TableCell>{formatCurrency(inv.total)}</TableCell>
                    <TableCell><Badge variant="outline">{inv.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
