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
import { createInvoice } from "@/app/(dashboard)/invoices/actions";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/constants";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface InvoiceFormProps {
  defaultWorkOrderId?: string;
}

export function InvoiceForm({ defaultWorkOrderId }: InvoiceFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [workOrderId, setWorkOrderId] = useState(defaultWorkOrderId ?? "");
  const [workOrders, setWorkOrders] = useState<{ id: string; title: string }[]>([]);
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unit_price: 0, amount: 0 }]);
  const [taxRate, setTaxRate] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("work_orders").select("id, title").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setWorkOrders(data ?? []));
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === "quantity" || field === "unit_price") {
        item.amount = Number(item.quantity) * Number(item.unit_price);
      }
      updated[index] = item;
      return updated;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unit_price: 0, amount: 0 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(formData: FormData) {
    formData.set("work_order_id", workOrderId);
    formData.set("items", JSON.stringify(items));
    formData.set("tax_rate", taxRate.toString());
    setLoading(true);
    try {
      await createInvoice(formData);
      toast.success("Invoice created");
      if (defaultWorkOrderId) {
        router.push(`/work-orders/${defaultWorkOrderId}`);
      } else {
        router.push("/invoices");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Work Order *</Label>
                <Select value={workOrderId} onValueChange={setWorkOrderId}>
                  <SelectTrigger><SelectValue placeholder="Select work order" /></SelectTrigger>
                  <SelectContent>
                    {workOrders.map((wo) => (
                      <SelectItem key={wo.id} value={wo.id}>{wo.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_date">Invoice Date</Label>
                <Input id="invoice_date" name="invoice_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_wo_number">Customer WO #</Label>
                <Input id="customer_wo_number" name="customer_wo_number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase_order_number">PO #</Label>
                <Input id="purchase_order_number" name="purchase_order_number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_terms_days">Payment Terms (days)</Label>
                <Input id="payment_terms_days" name="payment_terms_days" type="number" defaultValue={14} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Service Summary</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-1 h-3 w-3" /> Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5 space-y-1">
                  {index === 0 && <Label className="text-xs">Description</Label>}
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Service description"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  {index === 0 && <Label className="text-xs">Qty</Label>}
                  <Input
                    type="number" step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  {index === 0 && <Label className="text-xs">Unit Price</Label>}
                  <Input
                    type="number" step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  {index === 0 && <Label className="text-xs">Amount</Label>}
                  <Input value={formatCurrency(item.amount)} readOnly className="bg-gray-50" />
                </div>
                <div className="col-span-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} disabled={items.length === 1}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="border-t pt-4 space-y-2 max-w-xs ml-auto">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm items-center gap-4">
                <span>Tax Rate (%)</span>
                <Input
                  type="number" step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-24 text-right"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total Due</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea name="notes" rows={3} placeholder="Notes to appear on the invoice..." />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create Invoice"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
