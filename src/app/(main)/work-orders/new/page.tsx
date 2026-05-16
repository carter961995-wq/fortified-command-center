import { requireStaff } from "@/lib/require-staff";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import { createWorkOrder } from "@/actions/work-orders";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "New work order" };

export default async function NewWorkOrderPage() {
  const { supabase } = await requireStaff();
  const [{ data: customers }, { data: locations }, { data: subs }] = await Promise.all([
    supabase.from("customers").select("id, company_name").order("company_name"),
    supabase
      .from("locations")
      .select("id, location_name, city, state, customer_id, customers(company_name)")
      .order("location_name"),
    supabase.from("subcontractors").select("id, company_name").eq("status", "active").order("company_name"),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New work order</h1>
          <p className="text-sm text-muted-foreground">Create a commercial field ticket with billing context.</p>
        </div>
        <LinkButton href="/work-orders" variant="outline">
          Back
        </LinkButton>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Work order</CardTitle>
          <CardDescription>Customer, site, scope, and routing.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createWorkOrder} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer_id">Customer *</Label>
              <select id="customer_id" name="customer_id" required className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
                <option value="" disabled>
                  Select
                </option>
                {(customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location_id">Location *</Label>
              <select id="location_id" name="location_id" required className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
                <option value="" disabled>
                  Select site
                </option>
                {(locations ?? []).map((l) => {
                  const c = unwrapEmbed<{ company_name: string }>(l.customers);
                  return (
                    <option key={l.id} value={l.id}>
                      {(c?.company_name ?? "") + " — " + l.location_name + " (" + l.city + ", " + l.state + ")"}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="subcontractor_id">Subcontractor</Label>
              <select id="subcontractor_id" name="subcontractor_id" className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
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
              <Input id="title" name="title" required />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="scope_summary">Scope summary</Label>
              <Textarea id="scope_summary" name="scope_summary" rows={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade_type">Trade type *</Label>
              <Input id="trade_type" name="trade_type" required defaultValue="fence" placeholder="fence, gate, welding…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <select id="priority" name="priority" required className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm" defaultValue="normal">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <select id="status" name="status" required className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm" defaultValue="New">
                <option>New</option>
                <option>Needs Site Info</option>
                <option>Waiting on Sub Quote</option>
                <option>Quote Needed</option>
                <option>Quote Sent</option>
                <option>Approved</option>
                <option>Scheduled</option>
                <option>In Progress</option>
                <option>Completed by Sub</option>
                <option>Needs Review</option>
                <option>Ready to Invoice</option>
                <option>Invoiced</option>
                <option>Paid</option>
                <option>Closed</option>
                <option>Callback/Warranty</option>
                <option>Cancelled</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source *</Label>
              <select id="source" name="source" required className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm" defaultValue="direct">
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
              <Input id="customer_work_order_number" name="customer_work_order_number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase_order_number">PO #</Label>
              <Input id="purchase_order_number" name="purchase_order_number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="not_to_exceed_amount">NTE amount</Label>
              <Input id="not_to_exceed_amount" name="not_to_exceed_amount" type="number" step="0.01" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requested_date">Requested date</Label>
              <Input id="requested_date" name="requested_date" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" name="due_date" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled_date">Scheduled date</Label>
              <Input id="scheduled_date" name="scheduled_date" type="date" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="internal_notes">Internal notes</Label>
              <Textarea id="internal_notes" name="internal_notes" rows={3} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="customer_notes">Customer notes</Label>
              <Textarea id="customer_notes" name="customer_notes" rows={2} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">Create work order</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
