"use server";

import React from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { renderToBuffer } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/require-staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextInvoiceNumber } from "@/lib/document-numbers";
import { invoiceStatuses } from "@/lib/schemas";
import { FortifiedInvoiceDocument, type InvoicePdfRecord, type LinePdf } from "@/lib/pdf/invoice-document";
import { recalcInvoicePayments } from "@/lib/invoice-sync";
import { z } from "zod";

async function recalcInvoiceTotals(supabase: SupabaseClient, invoiceId: string) {
  const { data: lines } = await supabase.from("invoice_line_items").select("total").eq("invoice_id", invoiceId);
  const subtotal = (lines ?? []).reduce((a, l) => a + Number(l.total ?? 0), 0);
  const { data: inv } = await supabase.from("invoices").select("tax_amount").eq("id", invoiceId).single();
  const tax = Number(inv?.tax_amount ?? 0);
  const total = subtotal + tax;
  await supabase.from("invoices").update({ subtotal, total_amount: total }).eq("id", invoiceId);
  await recalcInvoicePayments(supabase, invoiceId);
}

export async function createInvoiceFromWorkOrder(workOrderId: string): Promise<void> {
  const { supabase } = await requireStaff();
  const { data: wo, error: woErr } = await supabase
    .from("work_orders")
    .select("id, customer_id, location_id, title, scope_summary, customers ( payment_terms )")
    .eq("id", workOrderId)
    .single();
  if (woErr || !wo) return;

  const custRaw = wo.customers as { payment_terms: string | null } | { payment_terms: string | null }[] | null;
  const cust = Array.isArray(custRaw) ? custRaw[0] : custRaw;
  const paymentTerms = cust?.payment_terms ?? "Net 30";

  const invoice_number = await nextInvoiceNumber(supabase);
  const today = new Date().toISOString().slice(0, 10);
  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({
      invoice_number,
      work_order_id: wo.id,
      customer_id: wo.customer_id,
      location_id: wo.location_id,
      status: "draft",
      invoice_date: today,
      due_date: today,
      payment_terms: paymentTerms,
      notes: wo.scope_summary,
      subtotal: 0,
      tax_amount: 0,
      total_amount: 0,
      amount_paid: 0,
      balance_due: 0,
    })
    .select("id")
    .single();
  if (error || !inv) return;

  await supabase.from("invoice_line_items").insert({
    invoice_id: inv.id,
    description: wo.title || "Services",
    quantity: 1,
    unit_price: 0,
    total: 0,
  });
  await recalcInvoiceTotals(supabase, inv.id);
  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/invoices");
  redirect(`/invoices/${inv.id}`);
}

export async function createInvoiceFromQuote(quoteId: string): Promise<void> {
  const { supabase } = await requireStaff();
  const { data: quote, error: qe } = await supabase
    .from("quotes")
    .select("id, work_order_id, customer_id, location_id, tax_amount, total_amount, internal_notes")
    .eq("id", quoteId)
    .single();
  if (qe || !quote) return;
  const { data: lines } = await supabase.from("quote_line_items").select("*").eq("quote_id", quoteId);

  const invoice_number = await nextInvoiceNumber(supabase);
  const today = new Date().toISOString().slice(0, 10);
  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({
      invoice_number,
      work_order_id: quote.work_order_id,
      customer_id: quote.customer_id,
      location_id: quote.location_id,
      status: "draft",
      invoice_date: today,
      due_date: today,
      tax_amount: quote.tax_amount ?? 0,
      notes: quote.internal_notes,
      subtotal: 0,
      total_amount: 0,
      amount_paid: 0,
      balance_due: 0,
    })
    .select("id")
    .single();
  if (error || !inv) return;

  for (const li of lines ?? []) {
    await supabase.from("invoice_line_items").insert({
      invoice_id: inv.id,
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unit_price,
      total: li.total,
    });
  }
  await recalcInvoiceTotals(supabase, inv.id);
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath(`/work-orders/${quote.work_order_id}`);
  revalidatePath("/invoices");
  redirect(`/invoices/${inv.id}`);
}

const invLineSchema = z.object({
  invoice_id: z.string().uuid(),
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number(),
});

export async function addInvoiceLineItem(formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const raw = Object.fromEntries(formData.entries());
  const parsed = invLineSchema.safeParse(raw);
  if (!parsed.success) return;
  const total = parsed.data.quantity * parsed.data.unit_price;
  const { error } = await supabase.from("invoice_line_items").insert({
    invoice_id: parsed.data.invoice_id,
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unit_price,
    total,
  });
  if (error) return;
  await recalcInvoiceTotals(supabase, parsed.data.invoice_id);
  const { data: inv } = await supabase.from("invoices").select("work_order_id").eq("id", parsed.data.invoice_id).single();
  revalidatePath(`/invoices/${parsed.data.invoice_id}`);
  if (inv?.work_order_id) revalidatePath(`/work-orders/${inv.work_order_id}`);
}

export async function deleteInvoiceLineItem(lineId: string, invoiceId: string): Promise<void> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("invoice_line_items").delete().eq("id", lineId);
  if (error) return;
  await recalcInvoiceTotals(supabase, invoiceId);
  const { data: inv } = await supabase.from("invoices").select("work_order_id").eq("id", invoiceId).single();
  revalidatePath(`/invoices/${invoiceId}`);
  if (inv?.work_order_id) revalidatePath(`/work-orders/${inv.work_order_id}`);
}

export async function updateInvoiceTax(formData: FormData): Promise<void> {
  const invoiceId = String(formData.get("invoice_id") ?? "");
  const tax = Number(formData.get("tax_amount") ?? 0);
  if (!invoiceId) return;
  const { supabase } = await requireStaff();
  const { data: lines } = await supabase.from("invoice_line_items").select("total").eq("invoice_id", invoiceId);
  const subtotal = (lines ?? []).reduce((a, l) => a + Number(l.total ?? 0), 0);
  const total = subtotal + tax;
  const { error } = await supabase
    .from("invoices")
    .update({ tax_amount: tax, subtotal, total_amount: total })
    .eq("id", invoiceId);
  if (error) return;
  await recalcInvoicePayments(supabase, invoiceId);
  const { data: inv } = await supabase.from("invoices").select("work_order_id").eq("id", invoiceId).single();
  revalidatePath(`/invoices/${invoiceId}`);
  if (inv?.work_order_id) revalidatePath(`/work-orders/${inv.work_order_id}`);
}

export async function setInvoiceStatus(formData: FormData): Promise<void> {
  const invoiceId = String(formData.get("invoice_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const { supabase } = await requireStaff();
  const s = invoiceStatuses.safeParse(status);
  if (!s.success || !invoiceId) return;
  const patch: Record<string, unknown> = { status: s.data };
  if (s.data === "sent") patch.sent_at = new Date().toISOString();
  const { data: inv } = await supabase.from("invoices").select("work_order_id").eq("id", invoiceId).single();
  const { error } = await supabase.from("invoices").update(patch).eq("id", invoiceId);
  if (error) return;
  if (s.data === "sent" && inv?.work_order_id) {
    await supabase
      .from("work_orders")
      .update({ status: "Invoiced", invoice_sent_at: new Date().toISOString() })
      .eq("id", inv.work_order_id);
    revalidatePath(`/work-orders/${inv.work_order_id}`);
  }
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}

export async function updateInvoiceMeta(formData: FormData): Promise<void> {
  const invoiceId = String(formData.get("invoice_id") ?? "");
  if (!invoiceId) return;
  const { supabase } = await requireStaff();
  const due_date = String(formData.get("due_date") ?? "").trim();
  const payment_terms = String(formData.get("payment_terms") ?? "").trim();
  const invoice_date = String(formData.get("invoice_date") ?? "").trim();
  const patch: Record<string, string | null> = {};
  if (due_date) patch.due_date = due_date;
  if (payment_terms) patch.payment_terms = payment_terms;
  if (invoice_date) patch.invoice_date = invoice_date;
  const { error } = await supabase.from("invoices").update(patch).eq("id", invoiceId);
  if (error) return;
  await recalcInvoicePayments(supabase, invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
  const { data: inv } = await supabase.from("invoices").select("work_order_id").eq("id", invoiceId).single();
  if (inv?.work_order_id) revalidatePath(`/work-orders/${inv.work_order_id}`);
}

export async function generateInvoicePdf(formData: FormData): Promise<void> {
  const invoiceId = String(formData.get("invoice_id") ?? "");
  if (!invoiceId) return;
  const { supabase } = await requireStaff();
  const admin = createAdminClient();

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select(
      `
      *,
      customers ( company_name, billing_address, contact_name, contact_email, contact_phone ),
      locations ( location_name, address_line_1, address_line_2, city, state, zip ),
      work_orders ( work_order_number, title, scope_summary, customer_work_order_number, purchase_order_number )
    `
    )
    .eq("id", invoiceId)
    .single();
  if (invErr || !invoice) return;

  const { data: lineItems } = await supabase.from("invoice_line_items").select("*").eq("invoice_id", invoiceId);

  const buffer = await renderToBuffer(
    React.createElement(FortifiedInvoiceDocument, {
      invoice: invoice as InvoicePdfRecord,
      lineItems: (lineItems ?? []) as LinePdf[],
    }) as Parameters<typeof renderToBuffer>[0]
  );

  const path = `${invoice.customer_id}/${invoiceId}.pdf`;
  const { error: upErr } = await admin.storage.from("invoices").upload(path, buffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) return;

  const {
    data: { publicUrl },
  } = admin.storage.from("invoices").getPublicUrl(path);
  const { error: u2 } = await supabase.from("invoices").update({ pdf_url: publicUrl }).eq("id", invoiceId);
  if (u2) return;

  revalidatePath(`/invoices/${invoiceId}`);
}
