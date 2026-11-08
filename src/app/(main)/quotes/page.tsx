import Link from "next/link";
import { requireStaff } from "@/lib/require-staff";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import { formatCurrency, formatDate } from "@/lib/format";
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
import { QuoteStatusBadge } from "@/components/status-badges";
import { PENDING_QUOTE_STATUSES, quoteNextAction } from "@/lib/operational-views";

export const metadata = { title: "Quotes" };

export default async function QuotesPage({
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

  let query = supabase
    .from("quotes")
    .select("id, quote_number, status, total_amount, valid_until, created_at, customers(company_name), work_orders(work_order_number)");

  if (sp.view === "pending") query = query.in("status", [...PENDING_QUOTE_STATUSES]);
  if (sp.view === "awaiting-approval") query = query.eq("status", "sent");
  if (sp.view === "approved") query = query.eq("status", "approved");
  if (sp.status) query = query.eq("status", sp.status);
  if (sp.customer_id) query = query.eq("customer_id", sp.customer_id);
  if (sp.q) query = query.ilike("quote_number", `%${sp.q}%`);

  query = query.order("created_at", { ascending: false });

  const [{ data: rows }, { data: customers }] = await Promise.all([
    query,
    supabase.from("customers").select("id, company_name").order("company_name"),
  ]);

  const totalVisible = (rows ?? []).reduce((sum, quote) => sum + Number(quote.total_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
        <p className="text-sm text-muted-foreground">Estimate pipeline with explicit customer-approval visibility before dispatch.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link
          href="/quotes?view=pending"
          className={`rounded-xl border p-4 transition hover:border-primary/50 hover:bg-muted/30 ${sp.view === "pending" ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <div className="font-medium">Pending estimates</div>
          <p className="mt-1 text-xs text-muted-foreground">Draft estimates plus quotes already sent and awaiting a decision.</p>
        </Link>
        <Link
          href="/quotes?view=awaiting-approval"
          className={`rounded-xl border p-4 transition hover:border-primary/50 hover:bg-muted/30 ${sp.view === "awaiting-approval" ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <div className="font-medium">Awaiting customer approval</div>
          <p className="mt-1 text-xs text-muted-foreground">Sent pricing that must not be treated as approved work.</p>
        </Link>
        <Link
          href="/quotes?view=approved"
          className={`rounded-xl border p-4 transition hover:border-primary/50 hover:bg-muted/30 ${sp.view === "approved" ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <div className="font-medium">Approved estimates</div>
          <p className="mt-1 text-xs text-muted-foreground">Customer-approved pricing ready for controlled scheduling and billing workflow.</p>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Estimate filters</CardTitle>
          <CardDescription>Use these views to separate pricing work from customer-approved work.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4">
            {sp.view ? <input type="hidden" name="view" value={sp.view} /> : null}
            <Input name="q" placeholder="Quote #" defaultValue={sp.q ?? ""} />
            <select name="status" defaultValue={sp.status ?? ""} className="h-10 rounded-lg border border-slate-500 bg-[#0b1524] px-2 text-sm font-semibold text-white">
              <option value="">Any status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
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
              <Link href="/quotes" className="app-btn">
                Clear
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <CardTitle className="text-base">Estimate queue</CardTitle>
              <CardDescription>{rows?.length ?? 0} visible estimates</CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              Visible quote value: <span className="font-semibold text-foreground">{formatCurrency(totalVisible)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>WO</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>Next action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((quote) => {
                const customer = unwrapEmbed<{ company_name: string }>(quote.customers);
                const workOrder = unwrapEmbed<{ work_order_number: string }>(quote.work_orders);
                return (
                  <TableRow key={quote.id}>
                    <TableCell>
                      <Link href={`/quotes/${quote.id}`} className="font-medium text-primary hover:underline">
                        {quote.quote_number}
                      </Link>
                      <div className="text-xs text-muted-foreground">Created {formatDate(quote.created_at)}</div>
                    </TableCell>
                    <TableCell>{customer?.company_name ?? "—"}</TableCell>
                    <TableCell>{workOrder?.work_order_number ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(quote.total_amount)}</TableCell>
                    <TableCell>
                      <QuoteStatusBadge status={quote.status} />
                    </TableCell>
                    <TableCell>{formatDate(quote.valid_until)}</TableCell>
                    <TableCell className="max-w-[320px] text-sm text-muted-foreground">{quoteNextAction(quote.status)}</TableCell>
                  </TableRow>
                );
              })}
              {(rows?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No estimates match these filters.
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
