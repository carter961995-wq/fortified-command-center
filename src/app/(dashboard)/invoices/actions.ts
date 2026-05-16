"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getInvoices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, work_order:work_orders(id, title, customer:customers(company_name))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getInvoice(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      *,
      invoice_items:invoice_items(*),
      work_order:work_orders(*,
        customer:customers(*),
        location:locations(*)
      ),
      payments(*)
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createInvoice(formData: FormData) {
  const supabase = await createClient();
  const items = JSON.parse(formData.get("items") as string) as {
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }[];
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxRate = parseFloat(formData.get("tax_rate") as string) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  const paymentTermsDays = parseInt(formData.get("payment_terms_days") as string) || 14;
  const invoiceDate = (formData.get("invoice_date") as string) || new Date().toISOString().split("T")[0];
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + paymentTermsDays);

  const { data: seqData } = await supabase.rpc("nextval", { seq_name: "invoice_number_seq" }).single();
  const invoiceNumber = `INV-${seqData ?? Date.now()}`;

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      work_order_id: formData.get("work_order_id") as string,
      invoice_number: invoiceNumber,
      customer_wo_number: (formData.get("customer_wo_number") as string) || null,
      purchase_order_number: (formData.get("purchase_order_number") as string) || null,
      description: (formData.get("description") as string) || null,
      subtotal,
      tax_rate: taxRate / 100,
      tax_amount: taxAmount,
      total,
      invoice_date: invoiceDate,
      due_date: dueDate.toISOString().split("T")[0],
      payment_terms_days: paymentTermsDays,
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("invoice_items").insert(
      items.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
      }))
    );
    if (itemsError) throw itemsError;
  }

  revalidatePath("/invoices");
  return invoice;
}

export async function updateInvoiceStatus(id: string, status: string) {
  const supabase = await createClient();
  const updates: Record<string, unknown> = { status };
  if (status === "Sent") updates.sent_date = new Date().toISOString().split("T")[0];
  if (status === "Paid") updates.paid_date = new Date().toISOString().split("T")[0];
  const { error } = await supabase.from("invoices").update(updates).eq("id", id);
  if (error) throw error;
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
}
