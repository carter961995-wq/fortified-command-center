import { createCustomer } from "@/actions/customers";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "New customer" };

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New customer</h1>
          <p className="text-sm text-muted-foreground">Create a commercial billing profile.</p>
        </div>
        <LinkButton href="/customers" variant="outline">
          Back
        </LinkButton>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer details</CardTitle>
          <CardDescription>Required fields are marked with *.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCustomer} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="company_name">Company name *</Label>
              <Input id="company_name" name="company_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact name</Label>
              <Input id="contact_name" name="contact_name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact email</Label>
              <Input id="contact_email" name="contact_email" type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact phone</Label>
              <Input id="contact_phone" name="contact_phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_email">Billing email</Label>
              <Input id="billing_email" name="billing_email" type="email" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="billing_address">Billing address</Label>
              <Textarea id="billing_address" name="billing_address" rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_terms">Payment terms</Label>
              <Input id="payment_terms" name="payment_terms" placeholder="Net 30" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_type">Customer type *</Label>
              <select
                id="customer_type"
                name="customer_type"
                required
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                defaultValue="commercial"
              >
                <option value="commercial">Commercial</option>
                <option value="residential">Residential</option>
                <option value="facilities_network">Facilities network</option>
                <option value="property_manager">Property manager</option>
                <option value="government">Government</option>
                <option value="school">School</option>
                <option value="retail">Retail</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <select
                id="status"
                name="status"
                required
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                defaultValue="active"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="prospect">Prospect</option>
              </select>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="submit">Save customer</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
