"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { nextQuoteNumber } from "@/lib/document-numbers";
import { quoteStatuses } from "@/lib/schemas";
import { z } from "zod";

async function recalcQuoteTotals(supabase: SupabaseClient, quoteId: string) {
  const { data: lines } = await supabase.from("quote_line_items").select("total").eq("quote_id", quoteId);
  const subtotal = (lines ?? []).reduce((a, l) => a + Number(l.total ?? 0), 0);
  const { data: q } = await supabase.from("quotes").select("tax_amount").eq("id", quoteId).single();
  const tax = Number(q?.tax_amount ?? 0);
  const total = subtotal + tax;
  await supabase.from("quotes").update({ subtotal, total_amount: total }).eq("id", quoteId);
}

export async function createQuoteFromWorkOrder(workOrderId: string): Promise<void> {
  const { supabase } = await requireStaff();
  const { data: wo, error: woErr } = await supabase
    .from("work_orders")
    .select("id, customer_id, location_id, title, scope_summary")
    .eq("id", workOrderId)
    .single();
  if (woErr || !wo) return;

  const quote_number = await nextQuoteNumber(supabase);
  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      quote_number,
      work_order_id: wo.id,
      customer_id: wo.customer_id,
      location_id: wo.location_id,
      status: "draft",
      customer_message: wo.title,
      internal_notes: wo.scope_summary,
    })
    .select("id")
    .single();
  if (error || !quote) return;

  await supabase.from("quote_line_items").insert({
    quote_id: quote.id,
    description: wo.title || "Service",
    quantity: 1,
    unit_price: 0,
    total: 0,
  });
  await recalcQuoteTotals(supabase, quote.id);
  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/quotes");
  redirect(`/quotes/${quote.id}`);
}

const lineSchema = z.object({
  quote_id: z.string().uuid(),
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number(),
});

export async function addQuoteLineItem(formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const raw = Object.fromEntries(formData.entries());
  const parsed = lineSchema.safeParse(raw);
  if (!parsed.success) return;
  const total = parsed.data.quantity * parsed.data.unit_price;
  const { error } = await supabase.from("quote_line_items").insert({
    quote_id: parsed.data.quote_id,
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unit_price,
    total,
  });
  if (error) return;
  await recalcQuoteTotals(supabase, parsed.data.quote_id);
  const { data: q } = await supabase.from("quotes").select("work_order_id").eq("id", parsed.data.quote_id).single();
  revalidatePath(`/quotes/${parsed.data.quote_id}`);
  if (q?.work_order_id) revalidatePath(`/work-orders/${q.work_order_id}`);
}

export async function deleteQuoteLineItem(lineId: string, quoteId: string): Promise<void> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("quote_line_items").delete().eq("id", lineId);
  if (error) return;
  await recalcQuoteTotals(supabase, quoteId);
  const { data: q } = await supabase.from("quotes").select("work_order_id").eq("id", quoteId).single();
  revalidatePath(`/quotes/${quoteId}`);
  if (q?.work_order_id) revalidatePath(`/work-orders/${q.work_order_id}`);
}

export async function updateQuoteTax(formData: FormData): Promise<void> {
  const quoteId = String(formData.get("quote_id") ?? "");
  const tax = Number(formData.get("tax_amount") ?? 0);
  if (!quoteId) return;
  const { supabase } = await requireStaff();
  const { data: lines } = await supabase.from("quote_line_items").select("total").eq("quote_id", quoteId);
  const subtotal = (lines ?? []).reduce((a, l) => a + Number(l.total ?? 0), 0);
  const total = subtotal + tax;
  const { error } = await supabase.from("quotes").update({ tax_amount: tax, subtotal, total_amount: total }).eq("id", quoteId);
  if (error) return;
  const { data: q } = await supabase.from("quotes").select("work_order_id").eq("id", quoteId).single();
  revalidatePath(`/quotes/${quoteId}`);
  if (q?.work_order_id) revalidatePath(`/work-orders/${q.work_order_id}`);
}

export async function setQuoteStatus(formData: FormData): Promise<void> {
  const quoteId = String(formData.get("quote_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const { supabase } = await requireStaff();
  const s = quoteStatuses.safeParse(status);
  if (!s.success || !quoteId) return;
  const patch: Record<string, unknown> = { status: s.data };
  if (s.data === "sent") patch.sent_at = new Date().toISOString();
  if (s.data === "approved") patch.approved_at = new Date().toISOString();

  const { data: quote } = await supabase.from("quotes").select("work_order_id").eq("id", quoteId).single();
  const { error } = await supabase.from("quotes").update(patch).eq("id", quoteId);
  if (error) return;

  if (s.data === "approved" && quote?.work_order_id) {
    await supabase
      .from("work_orders")
      .update({ status: "Approved", customer_approved_at: new Date().toISOString() })
      .eq("id", quote.work_order_id);
    revalidatePath(`/work-orders/${quote.work_order_id}`);
  }

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
}
