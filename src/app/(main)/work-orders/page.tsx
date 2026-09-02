import Link from "next/link";
import { requireStaff } from "@/lib/require-staff";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
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
import { WorkOrderStatusBadge } from "@/components/status-badges";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Work orders" };

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    customer_id?: string;
    trade?: string;
    priority?: string;
    sub_id?: string;
  }>;
}) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();

  let q = supabase
    .from("work_orders")
    .select(
      "id, work_order_number, title, status, priority, trade_type, scheduled_date, customers(company_name), locations(city, state), subcontractors(company_name)"
    )
    .order("created_at", { ascending: false });

  if (sp.status) q = q.eq("status", sp.status);
  if (sp.customer_id) q = q.eq("customer_id", sp.customer_id);
  if (sp.trade) q = q.eq("trade_type", sp.trade);
  if (sp.priority) q = q.eq("priority", sp.priority);
  if (sp.sub_id) q = q.eq("subcontractor_id", sp.sub_id);
  if (sp.q) q = q.or(`work_order_number.ilike.%${sp.q}%,title.ilike.%${sp.q}%`);

  const { data: rows } = await q;

  const { data: customers } = await supabase.from("customers").select("id, company_name").order("company_name");
  const { data: subs } = await supabase.from("subcontractors").select("id, company_name").order("company_name");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Work orders</h1>
          <p className="text-sm text-muted-foreground">Operational queue, scheduling, and billing readiness.</p>
        </div>
        <LinkButton href="/work-orders/new">New work order</LinkButton>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Search by WO number or title; narrow by status, geography, or partner.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            <Input name="q" placeholder="WO # or title…" defaultValue={sp.q ?? ""} />
            <select name="status" defaultValue={sp.status ?? ""} className="h-10 rounded-lg border border-slate-500 bg-[#0b1524] px-2 text-sm font-semibold text-white">
              <option value="">Any status</option>
              {[
                "New",
                "Needs Site Info",
                "Waiting on Sub Quote",
                "Quote Needed",
                "Quote Sent",
                "Approved",
                "Scheduled",
                "In Progress",
                "Completed by Sub",
                "Needs Review",
                "Ready to Invoice",
                "Invoiced",
                "Paid",
                "Closed",
                "Callback/Warranty",
                "Cancelled",
              ].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select name="customer_id" defaultValue={sp.customer_id ?? ""} className="h-10 rounded-lg border border-slate-500 bg-[#0b1524] px-2 text-sm font-semibold text-white">
              <option value="">Any customer</option>
              {(customers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
            <Input name="trade" placeholder="Trade type" defaultValue={sp.trade ?? ""} />
            <select name="priority" defaultValue={sp.priority ?? ""} className="h-10 rounded-lg border border-slate-500 bg-[#0b1524] px-2 text-sm font-semibold text-white">
              <option value="">Any priority</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
            <select name="sub_id" defaultValue={sp.sub_id ?? ""} className="h-10 rounded-lg border border-slate-500 bg-[#0b1524] px-2 text-sm font-semibold text-white md:col-span-2">
              <option value="">Any subcontractor</option>
              {(subs ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.company_name}
                </option>
              ))}
            </select>
            <div className="md:col-span-3 lg:col-span-4 flex gap-2">
              <button type="submit" className="app-btn app-btn-primary">
                Apply filters
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-0 pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WO</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Sub</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((w) => {
                const c = unwrapEmbed<{ company_name: string }>(w.customers);
                const l = unwrapEmbed<{ city: string; state: string }>(w.locations);
                const s = unwrapEmbed<{ company_name: string }>(w.subcontractors);
                return (
                  <TableRow key={w.id}>
                    <TableCell>
                      <Link href={`/work-orders/${w.id}`} className="font-medium text-primary hover:underline">
                        {w.work_order_number}
                      </Link>
                      <div className="text-xs text-muted-foreground">{w.title}</div>
                    </TableCell>
                    <TableCell>{c?.company_name ?? "—"}</TableCell>
                    <TableCell>{l ? `${l.city}, ${l.state}` : "—"}</TableCell>
                    <TableCell>{s?.company_name ?? "—"}</TableCell>
                    <TableCell>{w.scheduled_date ? formatDate(w.scheduled_date) : "—"}</TableCell>
                    <TableCell>
                      <WorkOrderStatusBadge status={w.status} />
                    </TableCell>
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
