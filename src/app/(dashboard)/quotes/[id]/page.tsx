import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getQuote } from "../actions";
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
import { ArrowLeft } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/constants";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let quote;
  try {
    quote = await getQuote(id);
  } catch {
    notFound();
  }

  const items = (quote.quote_items as { id: string; description: string; quantity: number; unit_price: number; amount: number }[]) ?? [];
  const wo = quote.work_order as { id: string; title: string; customer: { company_name: string }; location: { name: string } } | null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Quote ${quote.quote_number}`}
        description={wo?.title}
        actions={
          <Button variant="outline" asChild>
            <Link href="/quotes"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
        }
      />

      <div className="flex gap-2">
        <Badge variant="outline">{quote.status}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Customer</CardTitle></CardHeader>
          <CardContent><p>{wo?.customer?.company_name ?? "—"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Valid Until</CardTitle></CardHeader>
          <CardContent><p>{formatDate(quote.valid_until)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Total</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatCurrency(quote.total)}</p></CardContent>
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
                <TableCell className="text-right">{formatCurrency(quote.subtotal)}</TableCell>
              </TableRow>
              {quote.tax_amount > 0 && (
                <TableRow>
                  <TableCell colSpan={3}>Tax</TableCell>
                  <TableCell className="text-right">{formatCurrency(quote.tax_amount)}</TableCell>
                </TableRow>
              )}
              <TableRow className="font-bold text-lg">
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-right">{formatCurrency(quote.total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {quote.notes && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{quote.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
