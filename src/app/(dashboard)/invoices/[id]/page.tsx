import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getInvoice } from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Download, CreditCard } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/constants";
import { InvoiceStatusUpdater } from "@/components/invoices/status-updater";

function statusVariant(status: string) {
  switch (status) {
    case "Paid": return "default" as const;
    case "Sent": return "outline" as const;
    case "Overdue": return "destructive" as const;
    case "Void": return "secondary" as const;
    default: return "outline" as const;
  }
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let invoice;
  try {
    invoice = await getInvoice(id);
  } catch {
    notFound();
  }

  const items = (invoice.invoice_items as { id: string; description: string; quantity: number; unit_price: number; amount: number }[]) ?? [];
  const payments = (invoice.payments as { id: string; amount: number; payment_date: string; payment_method: string; reference_number: string | null }[]) ?? [];
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceDue = Number(invoice.total) - totalPaid;

  const wo = invoice.work_order as { id: string; title: string; customer: { company_name: string; contact_name: string; billing_address_line1: string; billing_city: string; billing_state: string; billing_zip: string }; location: { name: string; city: string; state: string; address_line1: string } } | null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Invoice ${invoice.invoice_number}`}
        description={wo?.title}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/invoices"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
            </Button>
            <Button asChild>
              <Link href={`/invoices/${id}/pdf`} target="_blank">
                <Download className="mr-2 h-4 w-4" /> Download PDF
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/payments/new?invoice_id=${id}`}>
                <CreditCard className="mr-2 h-4 w-4" /> Record Payment
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex gap-2">
        <Badge variant={statusVariant(invoice.status)}>{invoice.status}</Badge>
        {invoice.customer_wo_number && <Badge variant="secondary">WO# {invoice.customer_wo_number}</Badge>}
        {invoice.purchase_order_number && <Badge variant="secondary">PO# {invoice.purchase_order_number}</Badge>}
      </div>

      <InvoiceStatusUpdater invoiceId={invoice.id} currentStatus={invoice.status} />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Invoice Date</CardTitle></CardHeader>
          <CardContent><p>{formatDate(invoice.invoice_date)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Due Date</CardTitle></CardHeader>
          <CardContent><p>{formatDate(invoice.due_date)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Total</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatCurrency(invoice.total)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Balance Due</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${balanceDue > 0 ? "text-red-600" : "text-green-600"}`}>
              {formatCurrency(balanceDue)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Bill To</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{wo?.customer?.company_name}</p>
            <p>{wo?.customer?.contact_name}</p>
            <p>{wo?.customer?.billing_address_line1}</p>
            <p>{wo?.customer?.billing_city}, {wo?.customer?.billing_state} {wo?.customer?.billing_zip}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Job Location</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{wo?.location?.name}</p>
            <p>{wo?.location?.address_line1}</p>
            <p>{wo?.location?.city}, {wo?.location?.state}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell colSpan={3}>Subtotal</TableCell>
                <TableCell className="text-right">{formatCurrency(invoice.subtotal)}</TableCell>
              </TableRow>
              {invoice.tax_amount > 0 && (
                <TableRow>
                  <TableCell colSpan={3}>Tax ({(invoice.tax_rate * 100).toFixed(2)}%)</TableCell>
                  <TableCell className="text-right">{formatCurrency(invoice.tax_amount)}</TableCell>
                </TableRow>
              )}
              <TableRow className="font-bold text-lg">
                <TableCell colSpan={3}>Total Due</TableCell>
                <TableCell className="text-right">{formatCurrency(invoice.total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {payments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.payment_date)}</TableCell>
                    <TableCell>{p.payment_method}</TableCell>
                    <TableCell>{p.reference_number ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {invoice.notes && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{invoice.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
