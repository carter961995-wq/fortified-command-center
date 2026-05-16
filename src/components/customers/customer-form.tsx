"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCustomer, updateCustomer } from "@/app/(dashboard)/customers/actions";
import type { Customer } from "@/lib/types/database";
import { toast } from "sonner";

interface CustomerFormProps {
  customer?: Customer;
}

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEdit = !!customer;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      if (isEdit) {
        await updateCustomer(customer.id, formData);
        toast.success("Customer updated");
      } else {
        await createCustomer(formData);
        toast.success("Customer created");
      }
      router.push("/customers");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                name="company_name"
                defaultValue={customer?.company_name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Name *</Label>
              <Input
                id="contact_name"
                name="contact_name"
                defaultValue={customer?.contact_name}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={customer?.email ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={customer?.phone ?? ""}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="billing_address_line1">Address Line 1</Label>
              <Input
                id="billing_address_line1"
                name="billing_address_line1"
                defaultValue={customer?.billing_address_line1 ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_address_line2">Address Line 2</Label>
              <Input
                id="billing_address_line2"
                name="billing_address_line2"
                defaultValue={customer?.billing_address_line2 ?? ""}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billing_city">City</Label>
                <Input
                  id="billing_city"
                  name="billing_city"
                  defaultValue={customer?.billing_city ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing_state">State</Label>
                <Input
                  id="billing_state"
                  name="billing_state"
                  defaultValue={customer?.billing_state ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing_zip">ZIP</Label>
                <Input
                  id="billing_zip"
                  name="billing_zip"
                  defaultValue={customer?.billing_zip ?? ""}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment & Tax</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment_terms_days">Payment Terms (days)</Label>
              <Input
                id="payment_terms_days"
                name="payment_terms_days"
                type="number"
                defaultValue={customer?.payment_terms_days ?? 14}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="tax_exempt"
                name="tax_exempt"
                value="true"
                defaultChecked={customer?.tax_exempt ?? false}
              />
              <Label htmlFor="tax_exempt">Tax Exempt</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_rate">Tax Rate (%)</Label>
              <Input
                id="tax_rate"
                name="tax_rate"
                type="number"
                step="0.01"
                defaultValue={customer?.tax_rate ? (customer.tax_rate * 100).toString() : "0"}
              />
            </div>
            {isEdit && (
              <div className="flex items-center gap-3">
                <Switch
                  id="is_active"
                  name="is_active"
                  value="true"
                  defaultChecked={customer?.is_active ?? true}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="notes"
              name="notes"
              rows={5}
              defaultValue={customer?.notes ?? ""}
              placeholder="Internal notes about this customer..."
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : isEdit ? "Update Customer" : "Create Customer"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
