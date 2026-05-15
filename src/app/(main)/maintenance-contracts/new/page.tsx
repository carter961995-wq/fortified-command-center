import { requireStaff } from "@/lib/require-staff";
import { unwrapEmbed } from "@/lib/unwrap-embed";
import { createMaintenanceContract } from "@/actions/maintenance";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "New maintenance contract" };

export default async function NewMaintenanceContractPage() {
  const { supabase } = await requireStaff();
  const { data: customers } = await supabase.from("customers").select("id, company_name").order("company_name");
  const { data: locations } = await supabase
    .from("locations")
    .select("id, location_name, city, state, customer_id, customers(company_name)")
    .order("location_name");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New maintenance contract</h1>
          <p className="text-sm text-muted-foreground">Define billing, inspection cadence, and scope.</p>
        </div>
        <LinkButton href="/maintenance-contracts" variant="outline">
          Back
        </LinkButton>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Contract</CardTitle>
          <CardDescription>Link to a customer and optionally a single site.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createMaintenanceContract} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer_id">Customer *</Label>
              <select id="customer_id" name="customer_id" required className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
                {(customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location_id">Location (optional)</Label>
              <select id="location_id" name="location_id" className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
                <option value="">All sites / multi-site</option>
                {(locations ?? []).map((l) => {
                  const c = unwrapEmbed<{ company_name: string }>(l.customers);
                  return (
                    <option key={l.id} value={l.id}>
                      {(c?.company_name ?? "")} — {l.location_name}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="contract_name">Contract name *</Label>
              <Input id="contract_name" name="contract_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan_type">Plan *</Label>
              <select id="plan_type" name="plan_type" required className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="multi_site">Multi site</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <select id="status" name="status" required className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date *</Label>
              <Input id="start_date" name="start_date" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End date</Label>
              <Input id="end_date" name="end_date" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_frequency">Billing *</Label>
              <select id="billing_frequency" name="billing_frequency" required className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recurring_amount">Recurring amount *</Label>
              <Input id="recurring_amount" name="recurring_amount" type="number" step="0.01" required defaultValue={0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inspection_frequency">Inspection frequency *</Label>
              <select id="inspection_frequency" name="inspection_frequency" required className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semiannual">Semiannual</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount_percent">Discount %</Label>
              <Input id="discount_percent" name="discount_percent" type="number" step="0.1" />
            </div>
            <div className="sm:col-span-2 flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="priority_dispatch" />
                Priority dispatch
              </label>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="included_services">Included services</Label>
              <Textarea id="included_services" name="included_services" rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="excluded_services">Excluded services</Label>
              <Textarea id="excluded_services" name="excluded_services" rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">Save contract</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
