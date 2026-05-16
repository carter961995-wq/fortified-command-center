"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invoiceStatusFromBalance, statusTimestampUpdates, type PlainRow } from "@/lib/business";
import { moduleMap, type ModuleDefinition, type ModuleField } from "@/lib/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireSupabaseUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("You must be signed in to perform this action.");
  return { supabase, user: data.user };
}

function normalizeArray(raw: FormDataEntryValue | null) {
  if (!raw) return null;
  return String(raw)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function coerceField(field: ModuleField, formData: FormData) {
  if (field.type === "checkbox") return formData.get(field.name) === "on";
  const raw = formData.get(field.name);
  if (field.type === "array") return normalizeArray(raw);
  if (raw === null || String(raw).trim() === "") return null;
  if (field.type === "number" || field.type === "money") return Number(raw);
  return String(raw).trim();
}

function payloadFromForm(def: ModuleDefinition, formData: FormData) {
  const payload: PlainRow = {};
  for (const field of def.fields) {
    const value = coerceField(field, formData);
    if (value === null && ["work_order_number", "quote_number", "invoice_number"].includes(field.name)) continue;
    payload[field.name] = value;
  }
  return payload;
}

export async function createRecordAction(slug: string, formData: FormData) {
  const def = moduleMap[slug];
  if (!def) throw new Error("Unknown module.");
  const { supabase } = await requireSupabaseUser();
  const payload = payloadFromForm(def, formData);

  if (def.table === "work_orders" && typeof payload.status === "string") {
    Object.assign(payload, statusTimestampUpdates(payload.status));
  }
  if (def.table === "invoices") {
    const total = Number(payload.total_amount ?? 0);
    const paid = Number(payload.amount_paid ?? 0);
    payload.balance_due = Math.max(total - paid, 0);
    payload.status = invoiceStatusFromBalance(total, paid, payload.due_date ? String(payload.due_date) : null);
    if (payload.status === "paid" && !payload.paid_at) payload.paid_at = new Date().toISOString();
    if (["sent", "partially_paid", "paid", "overdue"].includes(String(payload.status)) && !payload.sent_at) payload.sent_at = new Date().toISOString();
  }

  const { data, error } = await supabase.from(def.table).insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath(`/${slug}`);
  redirect(`/${slug}/${String((data as PlainRow).id)}`);
}

export async function updateRecordAction(slug: string, id: string, formData: FormData) {
  const def = moduleMap[slug];
  if (!def) throw new Error("Unknown module.");
  const { supabase } = await requireSupabaseUser();
  const payload = payloadFromForm(def, formData);

  if (def.table === "work_orders" && typeof payload.status === "string") {
    const { data: existing } = await supabase.from("work_orders").select("customer_approved_at, completed_date, invoice_sent_at, paid_at").eq("id", id).maybeSingle();
    Object.assign(payload, statusTimestampUpdates(payload.status, (existing ?? {}) as PlainRow));
  }
  if (def.table === "invoices") {
    const total = Number(payload.total_amount ?? 0);
    const paid = Number(payload.amount_paid ?? 0);
    payload.balance_due = Math.max(total - paid, 0);
    payload.status = invoiceStatusFromBalance(total, paid, payload.due_date ? String(payload.due_date) : null);
    if (payload.status === "paid" && !payload.paid_at) payload.paid_at = new Date().toISOString();
  }

  const { error } = await supabase.from(def.table).update(payload).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/${id}`);
  redirect(`/${slug}/${id}`);
}

export async function advanceWorkOrderStatusAction(id: string, nextStatus: string) {
  const { supabase } = await requireSupabaseUser();
  const { data: existing, error: fetchError } = await supabase.from("work_orders").select("customer_approved_at, completed_date, invoice_sent_at, paid_at").eq("id", id).maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  const payload = { status: nextStatus, ...statusTimestampUpdates(nextStatus, (existing ?? {}) as PlainRow) };
  const { error } = await supabase.from("work_orders").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/work-orders/${id}`);
}

export async function addJobCostAction(workOrderId: string, formData: FormData) {
  const { supabase } = await requireSupabaseUser();
  const payload = {
    work_order_id: workOrderId,
    subcontractor_id: String(formData.get("subcontractor_id") ?? "") || null,
    cost_type: String(formData.get("cost_type") ?? "other"),
    description: String(formData.get("description") ?? ""),
    amount: Number(formData.get("amount") ?? 0),
    receipt_url: String(formData.get("receipt_url") ?? "") || null,
    paid: formData.get("paid") === "on",
    paid_at: String(formData.get("paid_at") ?? "") || null
  };
  const { error } = await supabase.from("job_costs").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath(`/work-orders/${workOrderId}`);
}

async function syncInvoiceTotals(invoiceId: string) {
  const { supabase } = await requireSupabaseUser();
  const [{ data: invoice }, { data: lineItems }, { data: payments }] = await Promise.all([
    supabase.from("invoices").select("total_amount, tax_amount, due_date, paid_at").eq("id", invoiceId).maybeSingle(),
    supabase.from("invoice_line_items").select("total").eq("invoice_id", invoiceId),
    supabase.from("payments").select("amount").eq("invoice_id", invoiceId)
  ]);
  const subtotal = ((lineItems ?? []) as PlainRow[]).reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const tax = Number((invoice as PlainRow | null)?.tax_amount ?? 0);
  const total = subtotal > 0 ? subtotal + tax : Number((invoice as PlainRow | null)?.total_amount ?? 0);
  const amountPaid = ((payments ?? []) as PlainRow[]).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const status = invoiceStatusFromBalance(total, amountPaid, (invoice as PlainRow | null)?.due_date ? String((invoice as PlainRow).due_date) : null);
  const balanceDue = Math.max(total - amountPaid, 0);
  const updates: PlainRow = { subtotal, total_amount: total, amount_paid: amountPaid, balance_due: balanceDue, status };
  if (status === "paid" && !(invoice as PlainRow | null)?.paid_at) updates.paid_at = new Date().toISOString();
  await supabase.from("invoices").update(updates).eq("id", invoiceId);
}

export async function addInvoiceLineItemAction(invoiceId: string, formData: FormData) {
  const { supabase } = await requireSupabaseUser();
  const quantity = Number(formData.get("quantity") ?? 1);
  const unitPrice = Number(formData.get("unit_price") ?? 0);
  const payload = {
    invoice_id: invoiceId,
    description: String(formData.get("description") ?? ""),
    quantity,
    unit_price: unitPrice,
    total: quantity * unitPrice
  };
  const { error } = await supabase.from("invoice_line_items").insert(payload);
  if (error) throw new Error(error.message);
  await syncInvoiceTotals(invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function addPaymentAction(invoiceId: string, customerId: string, formData: FormData) {
  const { supabase } = await requireSupabaseUser();
  const payload = {
    invoice_id: invoiceId,
    customer_id: customerId,
    amount: Number(formData.get("amount") ?? 0),
    payment_date: String(formData.get("payment_date") ?? new Date().toISOString().slice(0, 10)),
    payment_method: String(formData.get("payment_method") ?? "other"),
    reference_number: String(formData.get("reference_number") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null
  };
  const { error } = await supabase.from("payments").insert(payload);
  if (error) throw new Error(error.message);
  await syncInvoiceTotals(invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function addQuoteLineItemAction(quoteId: string, formData: FormData) {
  const { supabase } = await requireSupabaseUser();
  const quantity = Number(formData.get("quantity") ?? 1);
  const unitPrice = Number(formData.get("unit_price") ?? 0);
  const total = quantity * unitPrice;
  const { error } = await supabase.from("quote_line_items").insert({
    quote_id: quoteId,
    description: String(formData.get("description") ?? ""),
    quantity,
    unit_price: unitPrice,
    total
  });
  if (error) throw new Error(error.message);
  const { data } = await supabase.from("quote_line_items").select("total").eq("quote_id", quoteId);
  const subtotal = ((data ?? []) as PlainRow[]).reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const { data: quote } = await supabase.from("quotes").select("tax_amount").eq("id", quoteId).maybeSingle();
  const tax = Number((quote as PlainRow | null)?.tax_amount ?? 0);
  await supabase.from("quotes").update({ subtotal, total_amount: subtotal + tax }).eq("id", quoteId);
  revalidatePath(`/quotes/${quoteId}`);
}

export async function addMaintenanceVisitAction(contractId: string, formData: FormData) {
  const { supabase } = await requireSupabaseUser();
  const { error } = await supabase.from("maintenance_visits").insert({
    maintenance_contract_id: contractId,
    scheduled_date: String(formData.get("scheduled_date") ?? "") || null,
    completed_date: String(formData.get("completed_date") ?? "") || null,
    status: String(formData.get("status") ?? "scheduled"),
    notes: String(formData.get("notes") ?? "") || null
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/maintenance-contracts/${contractId}`);
}

export async function createWorkOrderFromVisitAction(visitId: string, contractId: string) {
  const { supabase } = await requireSupabaseUser();
  const { data: contract, error: contractError } = await supabase.from("maintenance_contracts").select("*, customers(company_name), locations(location_name)").eq("id", contractId).maybeSingle();
  if (contractError || !contract) throw new Error(contractError?.message ?? "Maintenance contract not found.");
  const row = contract as PlainRow;
  const { data: workOrder, error } = await supabase
    .from("work_orders")
    .insert({
      customer_id: row.customer_id,
      location_id: row.location_id,
      title: `Maintenance visit - ${row.contract_name}`,
      scope_summary: row.included_services,
      trade_type: "maintenance",
      priority: row.priority_dispatch ? "urgent" : "normal",
      status: "Scheduled",
      source: "direct",
      scheduled_date: new Date().toISOString().slice(0, 10),
      internal_notes: `Generated from maintenance contract ${row.contract_name}.`
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await supabase.from("maintenance_visits").update({ work_order_id: (workOrder as PlainRow).id }).eq("id", visitId);
  revalidatePath(`/maintenance-contracts/${contractId}`);
  redirect(`/work-orders/${String((workOrder as PlainRow).id)}`);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}
