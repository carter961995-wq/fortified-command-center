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
import { createPayment } from "@/app/(dashboard)/payments/actions";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const PAYMENT_METHODS = ["Check", "ACH", "Wire", "Credit Card", "Cash", "Other"];

interface PaymentFormProps {
  defaultInvoiceId?: string;
}

export function PaymentForm({ defaultInvoiceId }: PaymentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [invoiceId, setInvoiceId] = useState(defaultInvoiceId ?? "");
  const [paymentMethod, setPaymentMethod] = useState("Check");
  const [invoices, setInvoices] = useState<{ id: string; invoice_number: string; total: number }[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("invoices")
      .select("id, invoice_number, total")
      .in("status", ["Draft", "Sent", "Overdue"])
      .order("created_at", { ascending: false })
      .then(({ data }) => setInvoices(data ?? []));
  }, []);

  async function handleSubmit(formData: FormData) {
    formData.set("invoice_id", invoiceId);
    formData.set("payment_method", paymentMethod);
    setLoading(true);
    try {
      await createPayment(formData);
      toast.success("Payment recorded");
      if (defaultInvoiceId) {
        router.push(`/invoices/${defaultInvoiceId}`);
      } else {
        router.push("/payments");
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
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Invoice *</Label>
            <Select value={invoiceId} onValueChange={setInvoiceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select invoice" />
              </SelectTrigger>
              <SelectContent>
                {invoices.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.invoice_number} — ${Number(inv.total).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($) *</Label>
              <Input id="amount" name="amount" type="number" step="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_date">Date *</Label>
              <Input id="payment_date" name="payment_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference_number">Reference #</Label>
              <Input id="reference_number" name="reference_number" placeholder="Check #, etc." />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Recording…" : "Record Payment"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
