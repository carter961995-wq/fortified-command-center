import Link from "next/link";
import { requireStaff } from "@/lib/require-staff";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QuoteStatusBadge } from "@/components/status-badges";

export const metadata = { title: "Quotes" };

export default async function QuotesPage() {
  const { supabase } = await requireStaff();
  const { data: rows } = await supabase
    .from("quotes")
    .select("id, quote_number, status, total_amount, created_at, customers(company_name), work_orders(work_order_number)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
        <p className="text-sm text-muted-foreground">Customer pricing packages tied to work orders.</p>
      </div>
      <Card>
        <CardContent className="px-0 pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>WO</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((q) => {
                const c = unwrapEmbed<{ company_name: string }>(q.customers);
                const w = unwrapEmbed<{ work_order_number: string }>(q.work_orders);
                return (
                  <TableRow key={q.id}>
                    <TableCell>
                      <Link href={`/quotes/${q.id}`} className="font-medium text-primary hover:underline">
                        {q.quote_number}
                      </Link>
                    </TableCell>
                    <TableCell>{c?.company_name ?? "—"}</TableCell>
                    <TableCell>{w?.work_order_number ?? "—"}</TableCell>
                    <TableCell>{formatCurrency(q.total_amount)}</TableCell>
                    <TableCell>
                      <QuoteStatusBadge status={q.status} />
                    </TableCell>
                    <TableCell>{formatDate(q.created_at)}</TableCell>
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
