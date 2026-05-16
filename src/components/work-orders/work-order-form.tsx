"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createWorkOrder, updateWorkOrder } from "@/app/(dashboard)/work-orders/actions";
import type { WorkOrder, Customer, Subcontractor } from "@/lib/types/database";
import {
  WORK_ORDER_STATUSES,
  PRIORITIES,
  TRADE_TYPES,
} from "@/lib/constants";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface WorkOrderFormProps {
  workOrder?: WorkOrder;
  customers: Pick<Customer, "id" | "company_name">[];
  subcontractors: Pick<Subcontractor, "id" | "company_name">[];
}

export function WorkOrderForm({ workOrder, customers, subcontractors }: WorkOrderFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState(workOrder?.customer_id ?? "");
  const [locationId, setLocationId] = useState(workOrder?.location_id ?? "");
  const [subcontractorId, setSubcontractorId] = useState(workOrder?.subcontractor_id ?? "");
  const [tradeType, setTradeType] = useState<string>(workOrder?.trade_type ?? "Fence");
  const [priority, setPriority] = useState<string>(workOrder?.priority ?? "Medium");
  const [status, setStatus] = useState<string>(workOrder?.status ?? "New");
  const [source, setSource] = useState<string>(workOrder?.source ?? "Phone");
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const isEdit = !!workOrder;

  useEffect(() => {
    if (!customerId) {
      setLocations([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from("locations")
      .select("id, name")
      .eq("customer_id", customerId)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setLocations(data ?? []));
  }, [customerId]);

  async function handleSubmit(formData: FormData) {
    formData.set("customer_id", customerId);
    formData.set("location_id", locationId);
    formData.set("subcontractor_id", subcontractorId);
    formData.set("trade_type", tradeType);
    formData.set("priority", priority);
    formData.set("status", status);
    formData.set("source", source);
    setLoading(true);
    try {
      if (isEdit) {
        await updateWorkOrder(workOrder.id, formData);
        toast.success("Work order updated");
        router.push(`/work-orders/${workOrder.id}`);
      } else {
        const result = await createWorkOrder(formData);
        toast.success("Work order created");
        router.push(`/work-orders/${result.id}`);
      }
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
            <CardTitle>Work Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={workOrder?.title} required />
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
              <Label>Assigned Subcontractor</Label>
              <Select value={subcontractorId} onValueChange={setSubcontractorId}>
                <SelectTrigger><SelectValue placeholder="None assigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {subcontractors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope_summary">Scope Summary</Label>
              <Textarea id="scope_summary" name="scope_summary" defaultValue={workOrder?.scope_summary ?? ""} rows={3} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Classification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Trade Type</Label>
                <Select value={tradeType} onValueChange={setTradeType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRADE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WORK_ORDER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Phone", "Email", "Customer Portal", "Referral", "Other"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_wo_number">Customer WO #</Label>
                <Input id="customer_wo_number" name="customer_wo_number" defaultValue={workOrder?.customer_wo_number ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase_order_number">PO #</Label>
                <Input id="purchase_order_number" name="purchase_order_number" defaultValue={workOrder?.purchase_order_number ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nte_amount">NTE Amount ($)</Label>
              <Input id="nte_amount" name="nte_amount" type="number" step="0.01" defaultValue={workOrder?.nte_amount ?? ""} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requested_date">Requested Date</Label>
                <Input id="requested_date" name="requested_date" type="date" defaultValue={workOrder?.requested_date ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input id="due_date" name="due_date" type="date" defaultValue={workOrder?.due_date ?? ""} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduled_date">Scheduled Date</Label>
                <Input id="scheduled_date" name="scheduled_date" type="date" defaultValue={workOrder?.scheduled_date ?? ""} />
              </div>
              {isEdit && (
                <div className="space-y-2">
                  <Label htmlFor="completed_date">Completed Date</Label>
                  <Input id="completed_date" name="completed_date" type="date" defaultValue={workOrder?.completed_date ?? ""} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer_notes">Customer Notes</Label>
              <Textarea id="customer_notes" name="customer_notes" defaultValue={workOrder?.customer_notes ?? ""} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internal_notes">Internal Notes</Label>
              <Textarea id="internal_notes" name="internal_notes" defaultValue={workOrder?.internal_notes ?? ""} rows={3} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : isEdit ? "Update Work Order" : "Create Work Order"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
