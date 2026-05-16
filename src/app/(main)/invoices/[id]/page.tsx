import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import {
  updateInvoiceMeta,
  updateInvoiceTax,
  addInvoiceLineItem,
  deleteInvoiceLineItem,
  setInvoiceStatus,
  generateInvoicePdf,
} from "@/actions/invoices";
import { addPayment } from "@/actions/payments";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/components/status-badges";

export const metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: inv } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (!inv) notFound();
  const { data: lines } = await supabase.from("invoice_line_items").select("*").eq("invoice_id", id);
  const { data: pays } = await supabase.from("payments").select("*").eq("invoice_id", id).order("payment_date", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{inv.invoice_number}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <InvoiceStatusBadge status={inv.status} />
            <LinkButton href={`/work-orders/${inv.work_order_id}`} variant="outline" size="sm">
              Work order
            </LinkButton>
            {inv.pdf_url ? (
              <a
                href={inv.pdf_url}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
              >
                Open PDF
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={setInvoiceStatus}>
            <input type="hidden" name="invoice_id" value={id} />
            <div className="flex gap-2">
              <select name="status" defaultValue={inv.status} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="partially_paid">Partially paid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="void">Void</option>
              </select>
              <Button type="submit" size="sm">
                Update status
              </Button>
            </div>
          </form>
          <form action={generateInvoicePdf}>
            <input type="hidden" name="invoice_id" value={id} />
            <Button type="submit" size="sm" variant="secondary">
              Generate PDF
            </Button>
          </form>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateInvoiceMeta} className="grid gap-4 sm:grid-cols-3">
            <input type="hidden" name="invoice_id" value={id} />
            <div className="space-y-2">
              <Label htmlFor="invoice_date">Invoice date</Label>
              <Input id="invoice_date" name="invoice_date" type="date" defaultValue={inv.invoice_date ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" name="due_date" type="date" defaultValue={inv.due_date ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_terms">Payment terms</Label>
              <Input id="payment_terms" name="payment_terms" defaultValue={inv.payment_terms ?? ""} />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit" size="sm">
                Save details
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Subtotal</div>
            <div className="text-lg font-semibold tabular-nums">{formatCurrency(inv.subtotal)}</div>
          </div>
          <form action={updateInvoiceTax} className="flex items-end gap-2">
            <input type="hidden" name="invoice_id" value={id} />
            <div className="space-y-1">
              <Label htmlFor="tax_amount">Tax</Label>
              <Input id="tax_amount" name="tax_amount" type="number" step="0.01" defaultValue={Number(inv.tax_amount)} />
            </div>
            <Button type="submit" size="sm">
              Apply tax
            </Button>
          </form>
          <div>
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-lg font-semibold tabular-nums">{formatCurrency(inv.total_amount)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Paid / Balance</div>
            <div className="text-lg font-semibold tabular-nums">
              {formatCurrency(inv.amount_paid)} / {formatCurrency(inv.balance_due)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
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
                    <form action={deleteInvoiceLineItem.bind(null, li.id, id)}>
                      <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                        Remove
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <form action={addInvoiceLineItem} className="grid gap-2 md:grid-cols-5">
            <input type="hidden" name="invoice_id" value={id} />
            <Input className="md:col-span-2" name="description" placeholder="Description" required />
            <Input name="quantity" type="number" step="0.01" defaultValue={1} required />
            <Input name="unit_price" type="number" step="0.01" required />
            <Button type="submit">Add line</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>Manual payment entry updates balance and status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(pays ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.payment_date)}</TableCell>
                  <TableCell className="tabular-nums">{formatCurrency(p.amount)}</TableCell>
                  <TableCell className="capitalize">{p.payment_method}</TableCell>
                  <TableCell>{p.reference_number ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Separator />
          <form action={addPayment} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="invoice_id" value={id} />
            <input type="hidden" name="customer_id" value={inv.customer_id} />
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input name="amount" type="number" step="0.01" required />
            </div>
            <div className="space-y-1">
              <Label>Payment date</Label>
              <Input name="payment_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="space-y-1">
              <Label>Method</Label>
              <select name="payment_method" className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm" required defaultValue="check">
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="ach">ACH</option>
                <option value="card">Card</option>
                <option value="wire">Wire</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Reference #</Label>
              <Input name="reference_number" />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 space-y-1">
              <Label>Notes</Label>
              <Input name="notes" />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
              <Button type="submit">Record payment</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
