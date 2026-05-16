import { requireStaff } from "@/lib/require-staff";
import { createLocation } from "@/actions/locations";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "New location" };

export default async function NewLocationPage({
  searchParams,
}: {
  searchParams: Promise<{ customer_id?: string }>;
}) {
  const { customer_id } = await searchParams;
  const { supabase } = await requireStaff();
  const { data: customers } = await supabase.from("customers").select("id, company_name").order("company_name");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New location</h1>
          <p className="text-sm text-muted-foreground">Add a site under a customer account.</p>
        </div>
        <LinkButton href="/locations" variant="outline">
          Back
        </LinkButton>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Site details</CardTitle>
          <CardDescription>Address and access information used on work orders.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createLocation} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="customer_id">Customer *</Label>
              <select
                id="customer_id"
                name="customer_id"
                required
                defaultValue={customer_id ?? ""}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="" disabled>
                  Select customer
                </option>
                {(customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="location_name">Location name *</Label>
              <Input id="location_name" name="location_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store_number">Store #</Label>
              <Input id="store_number" name="store_number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gate_code">Gate code</Label>
              <Input id="gate_code" name="gate_code" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="address_line_1">Address line 1 *</Label>
              <Input id="address_line_1" name="address_line_1" required />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="address_line_2">Address line 2</Label>
              <Input id="address_line_2" name="address_line_2" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input id="city" name="city" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input id="state" name="state" required maxLength={2} className="uppercase" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP</Label>
              <Input id="zip" name="zip" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site_contact_name">Site contact</Label>
              <Input id="site_contact_name" name="site_contact_name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site_contact_phone">Site phone</Label>
              <Input id="site_contact_phone" name="site_contact_phone" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="site_contact_email">Site email</Label>
              <Input id="site_contact_email" name="site_contact_email" type="email" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="access_instructions">Access instructions</Label>
              <Textarea id="access_instructions" name="access_instructions" rows={3} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">Save location</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
