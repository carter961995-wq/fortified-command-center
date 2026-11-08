import Link from "next/link";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { requireStaff } from "@/lib/require-staff";
import { formatCurrency, formatDate } from "@/lib/format";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/components/status-badges";
import { OPEN_INVOICE_STATUSES } from "@/lib/operational-views";

export const metadata = { title: "Invoices" };

function dueAction(dueDate: string | null, today: string) {
  if (!dueDate) return "Confirm due date";
  const days = differenceInCalendarDays(new Date(`${dueDate}T00:00:00`), new Date(`${today}T00:00:00`));
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue - follow up`;
  if (days === 0) return "Due today - confirm remittance status";
  if (days <= 7) return `Due in ${days} day${days === 1 ? "" : "s"} - prepare follow-up`;
  return `Due in ${days} days`;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    customer_id?: string;
    view?: string;
  }>;
}) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const today = format(new Date(), "yyyy-MM-dd");
  const nextWeek = format(addDays(new Date(), 7), "yyyy-MM-dd");

  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, total_amount, balance_due, invoice_date, due_date, customers(company_name), work_orders(work_order_number)"
    );

  if (sp.view === "unpaid") {
    query = query.in("status", [...OPEN_INVOICE_STATUSES]).gt("balance_due", 0);
  }
  if (sp.view === "overdue") {
    query = query.in("status", [...OPEN_INVOICE_STATUSES]).gt("balance_due", 0).lt("due_date", today);
  }
  if (sp.view === "due-soon") {
    query = query
      .in("status", [...OPEN_INVOICE_STATUSES])
      .gt("balance_due", 0)
      .gte("due_date", today)
      .lte("due_date", nextWeek);
  }
  if (sp.status) query = query.eq("status", sp.status);
  if (sp.customer_id) query = query.eq("customer_id", sp.customer_id);
  if (sp.q) query = query.ilike("invoice_number", `%${sp.q}%`);

  query =
    sp.view === "unpaid" || sp.view === "overdue" || sp.view === "due-soon"
      ? query.order("due_date", { ascending: true }).order("created_at", { ascending: false })
      : query.order("created_at", { ascending: false });

  const [{ data: rows }, { data: customers }] = await Promise.all([
    query,
    supabase.from("customers").select("id, company_name").order("company_name"),
  ]);

  const visibleBalance = (rows ?? []).reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0);
  const visibleTotal = (rows ?? []).reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">Customer AR, due-date follow-up, PDFs, and payment application.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link
          href="/invoices?view=unpaid"
          className={`rounded-xl border p-4 transition hover:border-primary/50 hover:bg-muted/30 ${sp.view === "unpaid" ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <div className="font-medium">Unpaid invoices</div>
          <p className="mt-1 text-xs text-muted-foreground">Sent, partially paid, and overdue invoices with a remaining balance.</p>
        </Link>
        <Link
          href="/invoices?view=overdue"
          className={`rounded-xl border p-4 transition hover:border-primary/50 hover:bg-muted/30 ${sp.view === "overdue" ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <div className="font-medium">Overdue follow-up</div>
          <p className="mt-1 text-xs text-muted-foreground">Open balances whose contractual due date has passed.</p>
        </Link>
        <Link
          href="/invoices?view=due-soon"
          className={`rounded-xl border p-4 transition hover:border-primary/50 hover:bg-muted/30 ${sp.view === "due-soon" ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <div className="font-medium">Due in 7 days</div>
          <p className="mt-1 text-xs text-muted-foreground">Upcoming receivables that should be watched before they age.</p>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Invoice filters</CardTitle>
          <CardDescription>Filter AR without changing invoice status or posting payments.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4">
            {sp.view ? <input type="hidden" name="view" value={sp.view} /> : null}
            <Input name="q" placeholder="Invoice #" defaultValue={sp.q ?? ""} />
            <select name="status" defaultValue={sp.status ?? ""} className="h-10 rounded-lg border border-slate-500 bg-[#0b1524] px-2 text-sm font-semibold text-white">
              <option value="">Any status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="partially_paid">Partially paid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="void">Void</option>
            </select>
            <select name="customer_id" defaultValue={sp.customer_id ?? ""} className="h-10 rounded-lg border border-slate-500 bg-[#0b1524] px-2 text-sm font-semibold text-white">
              <option value="">Any customer</option>
              {(customers ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.company_name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="submit" className="app-btn app-btn-primary">
                Apply filters
              </button>
              <Link href="/invoices" className="app-btn">
                Clear
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Visible invoice value</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatCurrency(visibleTotal)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Visible outstanding balance</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatCurrency(visibleBalance)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Accounts receivable queue</CardTitle>
          <CardDescription>{rows?.length ?? 0} visible invoices</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>WO</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice date</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Follow-up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((invoice) => {
                const customer = unwrapEmbed<{ company_name: string }>(invoice.customers);
                const workOrder = unwrapEmbed<{ work_order_number: string }>(invoice.work_orders);
                return (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link href={`/invoices/${invoice.id}`} className="font-medium text-primary hover:underline">
                        {invoice.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>{customer?.company_name ?? "—"}</TableCell>
                    <TableCell>{workOrder?.work_order_number ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(invoice.total_amount)}</TableCell>
                    <TableCell className="tabular-nums font-medium">{formatCurrency(invoice.balance_due)}</TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                    <TableCell>{formatDate(invoice.due_date)}</TableCell>
                    <TableCell className="max-w-[240px] text-sm text-muted-foreground">
                      {Number(invoice.balance_due ?? 0) > 0 ? dueAction(invoice.due_date, today) : "Paid / no balance"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(rows?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    No invoices match these filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
