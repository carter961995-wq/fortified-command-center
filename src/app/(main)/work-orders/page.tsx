import Link from "next/link";
import { requireStaff } from "@/lib/require-staff";
import { unwrapEmbed } from "@/lib/unwrap-embed";
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
import { formatCurrency, formatDate } from "@/lib/format";
import { WORK_ORDER_VIEW_STATUSES, workOrderNextAction, type WorkOrderView } from "@/lib/operational-views";

export const metadata = { title: "Work orders" };

const QUICK_VIEWS: Array<{ key: WorkOrderView; label: string; description: string }> = [
  {
    key: "pending-estimates",
    label: "Pending estimates",
    description: "Site info, subcontractor pricing, quote creation, and estimates awaiting approval.",
  },
  {
    key: "confirmed-deadlines",
    label: "Confirmed deadlines",
    description: "Scheduled field commitments that need crew, material, and access readiness.",
  },
  {
    key: "awaiting-input",
    label: "Awaiting info / approval",
    description: "Jobs blocked by site details, sub pricing, customer approval, or completion review.",
  },
  {
    key: "subcontractor-dispatch",
    label: "Subcontractor assignments",
    description: "Approved or active work with an assigned subcontractor; dispatch approval still applies.",
  },
  {
    key: "invoice-ready",
    label: "Ready to invoice",
    description: "Completed approved scopes waiting for billing.",
  },
];

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

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
    state?: string;
    assignment?: string;
    scheduled_from?: string;
    scheduled_to?: string;
    view?: string;
  }>;
}) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();

  let stateLocationIds: string[] | null = null;
  if (sp.state) {
    const { data: stateLocations } = await supabase.from("locations").select("id").eq("state", sp.state);
    stateLocationIds = (stateLocations ?? []).map((location) => location.id);
  }

  let q = supabase
    .from("work_orders")
    .select(
      "id, work_order_number, title, status, priority, trade_type, not_to_exceed_amount, due_date, scheduled_date, customer_approved_at, subcontractor_id, customers(company_name), locations(city, state), subcontractors(company_name)"
    );

  const view = sp.view as WorkOrderView | undefined;
  if (view && view !== "confirmed-deadlines" && WORK_ORDER_VIEW_STATUSES[view]) {
    q = q.in("status", [...WORK_ORDER_VIEW_STATUSES[view]]);
  }
  if (view === "confirmed-deadlines") q = q.not("scheduled_date", "is", null);
  if (view === "subcontractor-dispatch") q = q.not("subcontractor_id", "is", null);

  if (sp.status) q = q.eq("status", sp.status);
  if (sp.customer_id) q = q.eq("customer_id", sp.customer_id);
  if (sp.trade) q = q.ilike("trade_type", `%${sp.trade}%`);
  if (sp.priority) q = q.eq("priority", sp.priority);
  if (sp.sub_id) q = q.eq("subcontractor_id", sp.sub_id);
  if (sp.assignment === "assigned") q = q.not("subcontractor_id", "is", null);
  if (sp.assignment === "unassigned") q = q.is("subcontractor_id", null);
  if (sp.scheduled_from) q = q.gte("scheduled_date", sp.scheduled_from);
  if (sp.scheduled_to) q = q.lte("scheduled_date", sp.scheduled_to);
  if (stateLocationIds) q = q.in("location_id", stateLocationIds.length ? stateLocationIds : [EMPTY_UUID]);
  if (sp.q) q = q.or(`work_order_number.ilike.%${sp.q}%,title.ilike.%${sp.q}%`);

  q =
    view === "confirmed-deadlines"
      ? q.order("scheduled_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })
      : q.order("created_at", { ascending: false });

  const [{ data: rawRows }, { data: customers }, { data: subs }, { data: stateRows }] = await Promise.all([
    q,
    supabase.from("customers").select("id, company_name").order("company_name"),
    supabase.from("subcontractors").select("id, company_name").order("company_name"),
    supabase.from("locations").select("state").not("state", "is", null).order("state"),
  ]);

  const rows =
    view === "confirmed-deadlines"
      ? (rawRows ?? []).filter((row) => !["Closed", "Cancelled"].includes(row.status))
      : (rawRows ?? []);
  const states = Array.from(new Set((stateRows ?? []).map((row) => row.state).filter(Boolean))) as string[];
  const visibleNte = rows.reduce((sum, row) => sum + Number(row.not_to_exceed_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Work orders</h1>
          <p className="text-sm text-muted-foreground">Operational queue, scheduling, approvals, dispatch readiness, and billing readiness.</p>
        </div>
        <LinkButton href="/work-orders/new">New work order</LinkButton>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {QUICK_VIEWS.map((item) => (
          <Link
            key={item.key}
            href={`/work-orders?view=${item.key}`}
            className={`rounded-xl border p-4 transition hover:border-primary/50 hover:bg-muted/30 ${
              view === item.key ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <div className="font-medium">{item.label}</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            Search and narrow the queue without changing operational records. Dispatches, financial commitments, and customer sends remain approval-gated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            {view ? <input type="hidden" name="view" value={view} /> : null}
            <Input name="q" placeholder="WO # or title..." defaultValue={sp.q ?? ""} />
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
            <select name="state" defaultValue={sp.state ?? ""} className="h-10 rounded-lg border border-slate-500 bg-[#0b1524] px-2 text-sm font-semibold text-white">
              <option value="">Any state</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
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
            <select name="assignment" defaultValue={sp.assignment ?? ""} className="h-10 rounded-lg border border-slate-500 bg-[#0b1524] px-2 text-sm font-semibold text-white">
              <option value="">Any assignment</option>
              <option value="assigned">Assigned to a subcontractor</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <select name="sub_id" defaultValue={sp.sub_id ?? ""} className="h-10 rounded-lg border border-slate-500 bg-[#0b1524] px-2 text-sm font-semibold text-white">
              <option value="">Any subcontractor</option>
              {(subs ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.company_name}
                </option>
              ))}
            </select>
            <Input name="scheduled_from" type="date" defaultValue={sp.scheduled_from ?? ""} aria-label="Scheduled from" />
            <Input name="scheduled_to" type="date" defaultValue={sp.scheduled_to ?? ""} aria-label="Scheduled to" />
            <div className="flex gap-2 md:col-span-3 lg:col-span-4">
              <button type="submit" className="app-btn app-btn-primary">
                Apply filters
              </button>
              <Link href="/work-orders" className="app-btn">
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
              <CardTitle className="text-base">Operational queue</CardTitle>
              <CardDescription>{rows.length} visible work orders</CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              Visible NTE total: <span className="font-semibold text-foreground">{formatCurrency(visibleNte)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WO</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Sub / NTE</TableHead>
                <TableHead>Schedule / due</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((w) => {
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
                      <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{w.priority ?? "normal"}</div>
                    </TableCell>
                    <TableCell>{c?.company_name ?? "—"}</TableCell>
                    <TableCell>{l ? `${l.city}, ${l.state}` : "—"}</TableCell>
                    <TableCell>
                      <div>{s?.company_name ?? "Unassigned"}</div>
                      <div className="text-xs text-muted-foreground">NTE {formatCurrency(w.not_to_exceed_amount)}</div>
                    </TableCell>
                    <TableCell>
                      <div>{w.scheduled_date ? `Scheduled ${formatDate(w.scheduled_date)}` : "Not scheduled"}</div>
                      <div className="text-xs text-muted-foreground">Due {formatDate(w.due_date)}</div>
                    </TableCell>
                    <TableCell>
                      {w.customer_approved_at ? (
                        <div className="text-sm">
                          <div className="font-medium text-emerald-300">Customer approved</div>
                          <div className="text-xs text-muted-foreground">{formatDate(w.customer_approved_at)}</div>
                        </div>
                      ) : s ? (
                        <div className="text-sm">
                          <div className="font-medium text-amber-300">Approval hold</div>
                          <div className="text-xs text-muted-foreground">Sub assigned; customer approval not recorded</div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not recorded</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <WorkOrderStatusBadge status={w.status} />
                    </TableCell>
                    <TableCell className="max-w-[300px] text-sm text-muted-foreground">{workOrderNextAction(w.status)}</TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No work orders match this operational view.
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
