"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { updateWorkOrderStatus } from "@/app/(dashboard)/work-orders/actions";
import { WORK_ORDER_STATUSES } from "@/lib/constants";
import { toast } from "sonner";

interface StatusUpdaterProps {
  workOrderId: string;
  currentStatus: string;
}

export function WorkOrderStatusUpdater({ workOrderId, currentStatus }: StatusUpdaterProps) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
    if (status === currentStatus) return;
    setLoading(true);
    try {
      await updateWorkOrderStatus(workOrderId, status);
      toast.success(`Status updated to "${status}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium">Quick Status:</span>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WORK_ORDER_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        disabled={loading || status === currentStatus}
        onClick={handleUpdate}
      >
        {loading ? "Updating…" : "Update"}
      </Button>
    </div>
  );
}
