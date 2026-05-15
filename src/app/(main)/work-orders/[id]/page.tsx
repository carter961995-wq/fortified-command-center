import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import {
  updateWorkOrder,
  updateWorkOrderStatus,
  addJobCost,
  deleteJobCost,
  addWorkOrderPhoto,
  addWorkOrderDocument,
} from "@/actions/work-orders";
import { createQuoteFromWorkOrder } from "@/actions/quotes";
import { createInvoiceFromWorkOrder } from "@/actions/invoices";
import { uploadWorkOrderFile } from "@/actions/uploads";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { WorkOrderStatusBadge, InvoiceStatusBadge, QuoteStatusBadge } from "@/components/status-badges";

const STATUSES = [
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
] as const;

export const metadata = { title: "Work order" };

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();

  const { data: wo } = await supabase
    .from("work_orders")
    .select(
      `
      *,
      customers ( id, company_name, payment_terms ),
      locations ( id, location_name, city, state, address_line_1, access_instructions ),
      subcontractors ( id, company_name )
    `
    )
    .eq("id", id)
    .single();
  if (!wo) notFound();

  const cust = unwrapEmbed<{ id: string; company_name: string; payment_terms: string | null }>(wo.customers);
  const loc = unwrapEmbed<{
    id: string;
    location_name: string;
    city: string;
    state: string;
    address_line_1: string;
    access_instructions: string | null;
  }>(wo.locations);
  const sub = unwrapEmbed<{ id: string; company_name: string }>(wo.subcontractors);

  const [{ data: fin }, { data: costs }, { data: photos }, { data: docs }, { data: quotes }, { data: invoices }] =
    await Promise.all([
      supabase.from("work_order_financials").select("*").eq("work_order_id", id).maybeSingle(),
      supabase.from("job_costs").select("*, subcontractors(company_name)").eq("work_order_id", id),
      supabase.from("work_order_photos").select("*").eq("work_order_id", id).order("created_at", { ascending: false }),
      supabase.from("work_order_documents").select("*").eq("work_order_id", id).order("created_at", { ascending: false }),
      supabase.from("quotes").select("*").eq("work_order_id", id).order("created_at", { ascending: false }),
      supabase.from("invoices").select("*").eq("work_order_id", id).order("created_at", { ascending: false }),
    ]);

  const { data: subs } = await supabase.from("subcontractors").select("id, company_name").eq("status", "active").order("company_name");
  const { data: customerList } = await supabase.from("customers").select("id, company_name").order("company_name");
  const { data: locationList } = await supabase
    .from("locations")
    .select("id, location_name, city, state, customer_id, customers(company_name)")
    .order("location_name");

  const invTotal = Number(fin?.invoice_total ?? 0);
  const jobCost = Number(fin?.total_job_costs ?? 0);
  const gp = Number(fin?.gross_profit ?? 0);
  const margin = Number(fin?.gross_margin_pct ?? 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{wo.work_order_number}</h1>
            <WorkOrderStatusBadge status={wo.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{wo.title}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {cust ? (
              <Link href={`/customers/${cust.id}`} className="text-primary hover:underline">
                {cust.company_name}
              </Link>
            ) : null}
            {loc ? (
              <span className="text-muted-foreground">
                ·{" "}
                <Link href={`/locations/${loc.id}`} className="text-primary hover:underline">
                  {loc.location_name}, {loc.city}, {loc.state}
                </Link>
              </span>
            ) : null}
            {sub ? (
              <span className="text-muted-foreground">
                · Sub:{" "}
                <Link href={`/subcontractors/${sub.id}`} className="text-primary hover:underline">
                  {sub.company_name}
                </Link>
              </span>
            ) : (
              <span className="text-muted-foreground">· Sub: Unassigned</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={createQuoteFromWorkOrder.bind(null, id)}>
            <Button type="submit" variant="secondary" size="sm">
              New quote
            </Button>
          </form>
          <form action={createInvoiceFromWorkOrder.bind(null, id)}>
            <Button type="submit" variant="secondary" size="sm">
              New invoice
            </Button>
          </form>
          <LinkButton href="/work-orders" variant="outline" size="sm">
            All work orders
          </LinkButton>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Invoice total</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatCurrency(invTotal)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Job costs</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatCurrency(jobCost)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gross profit</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatCurrency(gp)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gross margin</CardDescription>
            <CardTitle className="text-xl tabular-nums">{margin}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>Manual pipeline control for dispatch and billing.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateWorkOrderStatus.bind(null, id)} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Update status</Label>
              <select name="status" defaultValue={wo.status} className="h-8 min-w-[220px] rounded-lg border border-input bg-transparent px-2 text-sm">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm">
              Save status
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit work order</CardTitle>
          <CardDescription>Scope, references, dates, and assignments.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateWorkOrder.bind(null, id)} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="status" value={wo.status} />
            <div className="space-y-2">
              <Label htmlFor="customer_id">Customer *</Label>
              <select
                id="customer_id"
                name="customer_id"
                required
                defaultValue={wo.customer_id}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                {(customerList ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location_id">Location *</Label>
              <select
                id="location_id"
                name="location_id"
                required
                defaultValue={wo.location_id}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                {(locationList ?? []).map((l) => {
                  const c = unwrapEmbed<{ company_name: string }>(l.customers);
                  return (
                    <option key={l.id} value={l.id}>
                      {(c?.company_name ?? "")} — {l.location_name} ({l.city}, {l.state})
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="subcontractor_id">Subcontractor</Label>
              <select
                id="subcontractor_id"
                name="subcontractor_id"
                defaultValue={wo.subcontractor_id ?? ""}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="">Unassigned</option>
                {(subs ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.company_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required defaultValue={wo.title} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="scope_summary">Scope summary</Label>
              <Textarea id="scope_summary" name="scope_summary" rows={4} defaultValue={wo.scope_summary ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade_type">Trade type *</Label>
              <Input id="trade_type" name="trade_type" required defaultValue={wo.trade_type} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <select id="priority" name="priority" required className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm" defaultValue={wo.priority}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source *</Label>
              <select id="source" name="source" required className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm" defaultValue={wo.source}>
                <option value="direct">Direct</option>
                <option value="AGM">AGM</option>
                <option value="Home Depot">Home Depot</option>
                <option value="facilities_network">Facilities network</option>
                <option value="website">Website</option>
                <option value="phone">Phone</option>
                <option value="referral">Referral</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_work_order_number">Customer WO #</Label>
              <Input id="customer_work_order_number" name="customer_work_order_number" defaultValue={wo.customer_work_order_number ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase_order_number">PO #</Label>
              <Input id="purchase_order_number" name="purchase_order_number" defaultValue={wo.purchase_order_number ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="not_to_exceed_amount">NTE</Label>
              <Input id="not_to_exceed_amount" name="not_to_exceed_amount" type="number" step="0.01" defaultValue={wo.not_to_exceed_amount ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requested_date">Requested</Label>
              <Input id="requested_date" name="requested_date" type="date" defaultValue={wo.requested_date ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due</Label>
              <Input id="due_date" name="due_date" type="date" defaultValue={wo.due_date ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled_date">Scheduled</Label>
              <Input id="scheduled_date" name="scheduled_date" type="date" defaultValue={wo.scheduled_date ?? ""} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="internal_notes">Internal notes</Label>
              <Textarea id="internal_notes" name="internal_notes" rows={3} defaultValue={wo.internal_notes ?? ""} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="customer_notes">Customer notes</Label>
              <Textarea id="customer_notes" name="customer_notes" rows={2} defaultValue={wo.customer_notes ?? ""} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">Save work order</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job costs</CardTitle>
          <CardDescription>Subcontractor quotes, materials, permits, and other direct costs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(costs ?? []).map((row) => {
                const sc = row.subcontractors as { company_name: string } | null;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="capitalize">{row.cost_type}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell>{sc?.company_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.amount)}</TableCell>
                    <TableCell>{row.paid ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <form action={deleteJobCost.bind(null, row.id, id)}>
                        <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                          Remove
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Separator />
          <form action={addJobCost} className="grid gap-3 md:grid-cols-5">
            <input type="hidden" name="work_order_id" value={id} />
            <div className="space-y-1 md:col-span-2">
              <Label>Description</Label>
              <Input name="description" required placeholder="9Line labor estimate" />
            </div>
            <div className="space-y-1">
              <Label>Cost type</Label>
              <select name="cost_type" className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
                <option value="subcontractor">Subcontractor</option>
                <option value="materials">Materials</option>
                <option value="equipment">Equipment</option>
                <option value="travel">Travel</option>
                <option value="permit">Permit</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input name="amount" type="number" step="0.01" required />
            </div>
            <div className="space-y-1">
              <Label>Sub (optional)</Label>
              <select name="subcontractor_id" className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
                <option value="">—</option>
                {(subs ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.company_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 md:col-span-5">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="paid" />
                Mark paid
              </label>
              <Button type="submit" size="sm">
                Add cost
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
            <CardDescription>Upload field imagery to Supabase Storage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={uploadWorkOrderFile} encType="multipart/form-data" className="grid gap-2">
              <input type="hidden" name="work_order_id" value={id} />
              <input type="hidden" name="kind" value="photo" />
              <Input type="file" name="file" required />
              <select name="photo_type" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                <option value="before">Before</option>
                <option value="during">During</option>
                <option value="after">After</option>
                <option value="receipt">Receipt</option>
                <option value="damage">Damage</option>
                <option value="other">Other</option>
              </select>
              <Input name="caption" placeholder="Caption (optional)" />
              <Button type="submit" size="sm" variant="secondary">
                Upload photo
              </Button>
            </form>
            <Separator />
            <form action={addWorkOrderPhoto} className="grid gap-2">
              <input type="hidden" name="work_order_id" value={id} />
              <Input name="photo_url" placeholder="Or paste image URL" />
              <Button type="submit" size="sm" variant="outline">
                Add URL
              </Button>
            </form>
            <Table>
              <TableBody>
                {(photos ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <a href={p.photo_url} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                        {p.photo_type}
                      </a>
                      <div className="text-xs text-muted-foreground">{formatDate(p.created_at)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Completion packages, receipts, and contracts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={uploadWorkOrderFile} encType="multipart/form-data" className="grid gap-2">
              <input type="hidden" name="work_order_id" value={id} />
              <input type="hidden" name="kind" value="document" />
              <Input type="file" name="file" required />
              <select name="document_type" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                <option value="quote">Quote</option>
                <option value="invoice">Invoice</option>
                <option value="receipt">Receipt</option>
                <option value="completion_form">Completion form</option>
                <option value="contract">Contract</option>
                <option value="other">Other</option>
              </select>
              <Button type="submit" size="sm" variant="secondary">
                Upload document
              </Button>
            </form>
            <Separator />
            <form action={addWorkOrderDocument} className="grid gap-2">
              <input type="hidden" name="work_order_id" value={id} />
              <Input name="document_url" placeholder="Or paste document URL" />
              <Input name="filename" placeholder="Filename" />
              <Button type="submit" size="sm" variant="outline">
                Add URL
              </Button>
            </form>
            <Table>
              <TableBody>
                {(docs ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <a href={d.document_url} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                        {d.filename ?? d.document_type}
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quotes & invoices</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Quotes</h3>
            <Table>
              <TableBody>
                {(quotes ?? []).map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <Link href={`/quotes/${q.id}`} className="font-medium text-primary hover:underline">
                        {q.quote_number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <QuoteStatusBadge status={q.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(q.total_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Invoices</h3>
            <Table>
              <TableBody>
                {(invoices ?? []).map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <Link href={`/invoices/${i.id}`} className="font-medium text-primary hover:underline">
                        {i.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={i.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(i.total_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
