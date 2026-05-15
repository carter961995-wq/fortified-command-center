"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getPayments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*, invoice:invoices(id, invoice_number, total, work_order:work_orders(id, title, customer:customers(company_name)))")
    .order("payment_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPayment(formData: FormData) {
  const supabase = await createClient();
  const invoiceId = formData.get("invoice_id") as string;
  const { error } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    amount: parseFloat(formData.get("amount") as string),
    payment_date: (formData.get("payment_date") as string) || new Date().toISOString().split("T")[0],
    payment_method: formData.get("payment_method") as string,
    reference_number: (formData.get("reference_number") as string) || null,
    notes: (formData.get("notes") as string) || null,
  });
  if (error) throw error;
  revalidatePath("/payments");
  revalidatePath(`/invoices/${invoiceId}`);
}
