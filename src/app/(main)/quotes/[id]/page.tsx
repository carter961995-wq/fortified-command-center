import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { setQuoteStatus, updateQuoteTax, addQuoteLineItem, deleteQuoteLineItem } from "@/actions/quotes";
import { createInvoiceFromQuote } from "@/actions/invoices";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QuoteStatusBadge } from "@/components/status-badges";

export const metadata = { title: "Quote" };

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: q } = await supabase.from("quotes").select("*").eq("id", id).single();
  if (!q) notFound();
  const { data: lines } = await supabase.from("quote_line_items").select("*").eq("quote_id", id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{q.quote_number}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <QuoteStatusBadge status={q.status} />
            <LinkButton href={`/work-orders/${q.work_order_id}`} variant="outline" size="sm">
              Work order
            </LinkButton>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={setQuoteStatus}>
            <input type="hidden" name="quote_id" value={id} />
            <div className="flex gap-2">
              <select name="status" defaultValue={q.status} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
              <Button type="submit" size="sm">
                Update status
              </Button>
            </div>
          </form>
          <form action={createInvoiceFromQuote.bind(null, id)}>
            <Button type="submit" size="sm" variant="secondary">
              Create invoice
            </Button>
          </form>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Subtotal</div>
            <div className="text-lg font-semibold tabular-nums">{formatCurrency(q.subtotal)}</div>
          </div>
          <form action={updateQuoteTax} className="flex items-end gap-2">
            <input type="hidden" name="quote_id" value={id} />
            <div className="space-y-1">
              <Label htmlFor="tax_amount">Tax</Label>
              <Input id="tax_amount" name="tax_amount" type="number" step="0.01" defaultValue={Number(q.tax_amount)} />
            </div>
            <Button type="submit" size="sm">
              Apply tax
            </Button>
          </form>
          <div>
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-lg font-semibold tabular-nums">{formatCurrency(q.total_amount)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
          <CardDescription>Add labor, materials, and pass-through lines.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lines ?? []).map((li) => (
                <TableRow key={li.id}>
                  <TableCell>{li.description}</TableCell>
                  <TableCell className="text-right">{String(li.quantity)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(li.unit_price)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(li.total)}</TableCell>
                  <TableCell>
                    <form action={deleteQuoteLineItem.bind(null, li.id, id)}>
                      <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                        Remove
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <form action={addQuoteLineItem} className="grid gap-2 md:grid-cols-5">
            <input type="hidden" name="quote_id" value={id} />
            <Input className="md:col-span-2" name="description" placeholder="Description" required />
            <Input name="quantity" type="number" step="0.01" defaultValue={1} required />
            <Input name="unit_price" type="number" step="0.01" placeholder="Unit price" required />
            <Button type="submit" className="md:col-span-1">
              Add line
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
