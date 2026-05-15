"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createJobCost } from "@/app/(dashboard)/job-costs/actions";
import { JOB_COST_CATEGORIES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface JobCostFormProps {
  defaultWorkOrderId?: string;
}

export function JobCostForm({ defaultWorkOrderId }: JobCostFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("Subcontractor");
  const [workOrderId, setWorkOrderId] = useState(defaultWorkOrderId ?? "");
  const [workOrders, setWorkOrders] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("work_orders")
      .select("id, title")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setWorkOrders(data ?? []));
  }, []);

  async function handleSubmit(formData: FormData) {
    formData.set("work_order_id", workOrderId);
    formData.set("category", category);
    setLoading(true);
    try {
      await createJobCost(formData);
      toast.success("Job cost added");
      if (defaultWorkOrderId) {
        router.push(`/work-orders/${defaultWorkOrderId}`);
      } else {
        router.push("/job-costs");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Cost Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Work Order *</Label>
            <Select value={workOrderId} onValueChange={setWorkOrderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select work order" />
              </SelectTrigger>
              <SelectContent>
                {workOrders.map((wo) => (
                  <SelectItem key={wo.id} value={wo.id}>{wo.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {JOB_COST_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input id="description" name="description" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($) *</Label>
              <Input id="amount" name="amount" type="number" step="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor_name">Vendor Name</Label>
            <Input id="vendor_name" name="vendor_name" />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Add Job Cost"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
