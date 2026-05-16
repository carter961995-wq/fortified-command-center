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
import { getPayments } from "./actions";
import { formatCurrency, formatDate } from "@/lib/constants";

export default async function PaymentsPage() {
  let payments: Awaited<ReturnType<typeof getPayments>> = [];
  let error: string | null = null;

  try {
    payments = await getPayments();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load payments";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Track all received payments" />

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-center text-muted-foreground">{error}</div>
          ) : payments.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No payments recorded yet. Record payments from invoice detail pages.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => {
                  const inv = p.invoice as { id: string; invoice_number: string; work_order: { id: string; title: string; customer: { company_name: string } } } | null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.payment_date)}</TableCell>
                      <TableCell>
                        {inv ? (
                          <Link href={`/invoices/${inv.id}`} className="text-blue-600 hover:underline">{inv.invoice_number}</Link>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{inv?.work_order?.customer?.company_name ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{p.payment_method}</Badge></TableCell>
                      <TableCell>{p.reference_number ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(p.amount)}</TableCell>
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
