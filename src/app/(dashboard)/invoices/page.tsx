import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getInvoices } from "./actions";
import { formatCurrency, formatDate } from "@/lib/constants";

function statusVariant(status: string) {
  switch (status) {
    case "Paid": return "default" as const;
    case "Sent": return "outline" as const;
    case "Overdue": return "destructive" as const;
    case "Void": return "secondary" as const;
    default: return "outline" as const;
  }
}

export default async function InvoicesPage() {
  let invoices: Awaited<ReturnType<typeof getInvoices>> = [];
  let error: string | null = null;

  try {
    invoices = await getInvoices();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load invoices";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Manage customer invoices" />

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-center text-muted-foreground">{error}</div>
          ) : invoices.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No invoices yet. Create invoices from work order detail pages.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Work Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const wo = inv.work_order as { id: string; title: string; customer: { company_name: string } } | null;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link href={`/invoices/${inv.id}`} className="font-medium text-blue-600 hover:underline">
                          {inv.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {wo ? <Link href={`/work-orders/${wo.id}`} className="text-blue-600 hover:underline">{wo.title}</Link> : "—"}
                      </TableCell>
                      <TableCell>{wo?.customer?.company_name ?? "—"}</TableCell>
                      <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                      <TableCell>{formatDate(inv.due_date)}</TableCell>
                      <TableCell>{formatCurrency(inv.total)}</TableCell>
                      <TableCell><Badge variant={statusVariant(inv.status)}>{inv.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
