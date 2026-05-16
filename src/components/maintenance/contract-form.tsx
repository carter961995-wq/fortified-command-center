"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
import {
  createMaintenanceContract,
  updateMaintenanceContract,
} from "@/app/(dashboard)/maintenance-contracts/actions";
import type { MaintenanceContract, Customer } from "@/lib/types/database";
import { MAINTENANCE_FREQUENCIES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface ContractFormProps {
  contract?: MaintenanceContract;
  customers: Pick<Customer, "id" | "company_name">[];
}

export function MaintenanceContractForm({ contract, customers }: ContractFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState(contract?.customer_id ?? "");
  const [locationId, setLocationId] = useState(contract?.location_id ?? "");
  const [frequency, setFrequency] = useState<string>(contract?.frequency ?? "Monthly");
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const isEdit = !!contract;

  useEffect(() => {
    if (!customerId) { setLocations([]); return; }
    const supabase = createClient();
    supabase.from("locations").select("id, name").eq("customer_id", customerId).eq("is_active", true).order("name")
      .then(({ data }) => setLocations(data ?? []));
  }, [customerId]);

  async function handleSubmit(formData: FormData) {
    formData.set("customer_id", customerId);
    formData.set("location_id", locationId);
    formData.set("frequency", frequency);
    setLoading(true);
    try {
      if (isEdit) {
        await updateMaintenanceContract(contract.id, formData);
        toast.success("Contract updated");
      } else {
        await createMaintenanceContract(formData);
        toast.success("Contract created");
      }
      router.push("/maintenance-contracts");
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
          <CardHeader><CardTitle>Contract Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={contract?.title} required />
            </div>
            <div className="space-y-2">
              <Label>Customer *</Label>
              <Select value={customerId} onValueChange={(val) => { setCustomerId(val); setLocationId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location *</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" defaultValue={contract?.description ?? ""} rows={3} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Schedule & Billing</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthly_amount">Monthly Amount ($) *</Label>
                <Input id="monthly_amount" name="monthly_amount" type="number" step="0.01" defaultValue={contract?.monthly_amount ?? ""} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date *</Label>
                <Input id="start_date" name="start_date" type="date" defaultValue={contract?.start_date ?? ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input id="end_date" name="end_date" type="date" defaultValue={contract?.end_date ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="next_visit_date">Next Visit Date</Label>
              <Input id="next_visit_date" name="next_visit_date" type="date" defaultValue={contract?.next_visit_date ?? ""} />
            </div>
            {isEdit && (
              <div className="flex items-center gap-3">
                <Switch id="is_active" name="is_active" value="true" defaultChecked={contract?.is_active} />
                <Label htmlFor="is_active">Active</Label>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" defaultValue={contract?.notes ?? ""} rows={3} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : isEdit ? "Update Contract" : "Create Contract"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
