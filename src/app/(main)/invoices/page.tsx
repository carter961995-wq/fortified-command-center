import Link from "next/link";
import { requireStaff } from "@/lib/require-staff";
import { formatCurrency, formatDate } from "@/lib/format";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/components/status-badges";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const { supabase } = await requireStaff();
  const { data: rows } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total_amount, balance_due, invoice_date, customers(company_name), work_orders(work_order_number)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">Customer AR, PDFs, and payment application.</p>
      </div>
      <Card>
        <CardContent className="px-0 pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>WO</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((inv) => {
                const c = unwrapEmbed<{ company_name: string }>(inv.customers);
                const w = unwrapEmbed<{ work_order_number: string }>(inv.work_orders);
                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link href={`/invoices/${inv.id}`} className="font-medium text-primary hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>{c?.company_name ?? "—"}</TableCell>
                    <TableCell>{w?.work_order_number ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(inv.total_amount)}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(inv.balance_due)}</TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
