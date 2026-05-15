"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getQuotes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*, work_order:work_orders(id, title, customer:customers(company_name))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getQuote(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*, quote_items:quote_items(*), work_order:work_orders(*, customer:customers(*), location:locations(*))")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createQuote(formData: FormData) {
  const supabase = await createClient();
  const items = JSON.parse(formData.get("items") as string) as {
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }[];
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = parseFloat(formData.get("tax_amount") as string) || 0;
  const total = subtotal + taxAmount;

  const { data: seqData } = await supabase.rpc("nextval", { seq_name: "quote_number_seq" }).single();
  const quoteNumber = `Q-${seqData ?? Date.now()}`;

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      work_order_id: formData.get("work_order_id") as string,
      quote_number: quoteNumber,
      description: (formData.get("description") as string) || null,
      subtotal,
      tax_amount: taxAmount,
      total,
      valid_until: (formData.get("valid_until") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("quote_items").insert(
      items.map((item) => ({
        quote_id: quote.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
      }))
    );
    if (itemsError) throw itemsError;
  }

  revalidatePath("/quotes");
  return quote;
}

export async function updateQuoteStatus(id: string, status: string) {
  const supabase = await createClient();
  const updates: Record<string, unknown> = { status };
  if (status === "Sent") updates.sent_date = new Date().toISOString().split("T")[0];
  if (status === "Accepted") updates.accepted_date = new Date().toISOString().split("T")[0];
  const { error } = await supabase.from("quotes").update(updates).eq("id", id);
  if (error) throw error;
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
}
