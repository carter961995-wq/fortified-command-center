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
import { updateInvoiceStatus } from "@/app/(dashboard)/invoices/actions";
import { toast } from "sonner";

const INVOICE_STATUSES = ["Draft", "Sent", "Paid", "Overdue", "Void"];

interface StatusUpdaterProps {
  invoiceId: string;
  currentStatus: string;
}

export function InvoiceStatusUpdater({ invoiceId, currentStatus }: StatusUpdaterProps) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
    if (status === currentStatus) return;
    setLoading(true);
    try {
      await updateInvoiceStatus(invoiceId, status);
      toast.success(`Invoice status updated to "${status}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium">Status:</span>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {INVOICE_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" disabled={loading || status === currentStatus} onClick={handleUpdate}>
        {loading ? "Updating…" : "Update"}
      </Button>
    </div>
  );
}
