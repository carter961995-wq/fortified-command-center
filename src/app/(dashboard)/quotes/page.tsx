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
import { getQuotes } from "./actions";
import { formatCurrency } from "@/lib/constants";

export default async function QuotesPage() {
  let quotes: Awaited<ReturnType<typeof getQuotes>> = [];
  let error: string | null = null;

  try {
    quotes = await getQuotes();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load quotes";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Quotes" description="Manage customer quotes" />

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-center text-muted-foreground">{error}</div>
          ) : quotes.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No quotes yet. Create quotes from work order detail pages.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Work Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => {
                  const wo = q.work_order as { id: string; title: string; customer: { company_name: string } } | null;
                  return (
                    <TableRow key={q.id}>
                      <TableCell>
                        <Link href={`/quotes/${q.id}`} className="font-medium text-blue-600 hover:underline">
                          {q.quote_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {wo ? <Link href={`/work-orders/${wo.id}`} className="text-blue-600 hover:underline">{wo.title}</Link> : "—"}
                      </TableCell>
                      <TableCell>{wo?.customer?.company_name ?? "—"}</TableCell>
                      <TableCell>{formatCurrency(q.total)}</TableCell>
                      <TableCell><Badge variant="outline">{q.status}</Badge></TableCell>
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
