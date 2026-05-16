"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createLocation, updateLocation } from "@/app/(dashboard)/locations/actions";
import type { Location, Customer } from "@/lib/types/database";
import { US_STATES } from "@/lib/constants";
import { toast } from "sonner";

interface LocationFormProps {
  location?: Location;
  customers: Pick<Customer, "id" | "company_name">[];
}

export function LocationForm({ location, customers }: LocationFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState(location?.customer_id ?? "");
  const [state, setState] = useState(location?.state ?? "");
  const isEdit = !!location;

  async function handleSubmit(formData: FormData) {
    formData.set("customer_id", customerId);
    formData.set("state", state);
    setLoading(true);
    try {
      if (isEdit) {
        await updateLocation(location.id, formData);
        toast.success("Location updated");
      } else {
        await createLocation(formData);
        toast.success("Location created");
      }
      router.push("/locations");
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
            <CardTitle>Location Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Location Name *</Label>
              <Input id="name" name="name" defaultValue={location?.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_line1">Address *</Label>
              <Input
                id="address_line1"
                name="address_line1"
                defaultValue={location?.address_line1}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input
                id="address_line2"
                name="address_line2"
                defaultValue={location?.address_line2 ?? ""}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input id="city" name="city" defaultValue={location?.city} required />
              </div>
              <div className="space-y-2">
                <Label>State *</Label>
                <Select value={state} onValueChange={setState} required>
                  <SelectTrigger>
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP *</Label>
                <Input id="zip" name="zip" defaultValue={location?.zip} required />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access & Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gate_code">Gate Code</Label>
              <Input id="gate_code" name="gate_code" defaultValue={location?.gate_code ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="access_instructions">Access Instructions</Label>
              <Textarea
                id="access_instructions"
                name="access_instructions"
                defaultValue={location?.access_instructions ?? ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="site_contact_name">Site Contact</Label>
                <Input
                  id="site_contact_name"
                  name="site_contact_name"
                  defaultValue={location?.site_contact_name ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site_contact_phone">Site Phone</Label>
                <Input
                  id="site_contact_phone"
                  name="site_contact_phone"
                  defaultValue={location?.site_contact_phone ?? ""}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" defaultValue={location?.notes ?? ""} />
            </div>
            {isEdit && (
              <div className="flex items-center gap-3">
                <Switch
                  id="is_active"
                  name="is_active"
                  value="true"
                  defaultChecked={location?.is_active ?? true}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : isEdit ? "Update Location" : "Create Location"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
