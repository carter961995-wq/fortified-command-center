"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getWorkOrders(filters?: { status?: string; priority?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("work_orders")
    .select(`
      *,
      customer:customers(id, company_name),
      location:locations(id, name, city, state),
      subcontractor:subcontractors(id, company_name)
    `)
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.priority) query = query.eq("priority", filters.priority);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getWorkOrder(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_orders")
    .select(`
      *,
      customer:customers(*),
      location:locations(*),
      subcontractor:subcontractors(id, company_name, phone, email),
      job_costs(*),
      quotes(*, quote_items:quote_items(*)),
      invoices(*, invoice_items:invoice_items(*), payments(*))
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createWorkOrder(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_orders")
    .insert({
      customer_id: formData.get("customer_id") as string,
      location_id: formData.get("location_id") as string,
      subcontractor_id: (formData.get("subcontractor_id") as string) || null,
      title: formData.get("title") as string,
      scope_summary: (formData.get("scope_summary") as string) || null,
      trade_type: formData.get("trade_type") as string,
      priority: formData.get("priority") as string,
      status: (formData.get("status") as string) || "New",
      source: (formData.get("source") as string) || "Phone",
      customer_wo_number: (formData.get("customer_wo_number") as string) || null,
      purchase_order_number: (formData.get("purchase_order_number") as string) || null,
      nte_amount: parseFloat(formData.get("nte_amount") as string) || null,
      requested_date: (formData.get("requested_date") as string) || null,
      due_date: (formData.get("due_date") as string) || null,
      scheduled_date: (formData.get("scheduled_date") as string) || null,
      customer_notes: (formData.get("customer_notes") as string) || null,
      internal_notes: (formData.get("internal_notes") as string) || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/work-orders");
  return data;
}

export async function updateWorkOrder(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("work_orders")
    .update({
      customer_id: formData.get("customer_id") as string,
      location_id: formData.get("location_id") as string,
      subcontractor_id: (formData.get("subcontractor_id") as string) || null,
      title: formData.get("title") as string,
      scope_summary: (formData.get("scope_summary") as string) || null,
      trade_type: formData.get("trade_type") as string,
      priority: formData.get("priority") as string,
      status: formData.get("status") as string,
      source: (formData.get("source") as string) || "Phone",
      customer_wo_number: (formData.get("customer_wo_number") as string) || null,
      purchase_order_number: (formData.get("purchase_order_number") as string) || null,
      nte_amount: parseFloat(formData.get("nte_amount") as string) || null,
      requested_date: (formData.get("requested_date") as string) || null,
      due_date: (formData.get("due_date") as string) || null,
      scheduled_date: (formData.get("scheduled_date") as string) || null,
      completed_date: (formData.get("completed_date") as string) || null,
      customer_notes: (formData.get("customer_notes") as string) || null,
      internal_notes: (formData.get("internal_notes") as string) || null,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/work-orders");
  revalidatePath(`/work-orders/${id}`);
}

export async function updateWorkOrderStatus(id: string, status: string) {
  const supabase = await createClient();
  const updates: Record<string, unknown> = { status };
  if (status === "Closed" || status === "Paid") {
    updates.completed_date = new Date().toISOString().split("T")[0];
  }
  const { error } = await supabase.from("work_orders").update(updates).eq("id", id);
  if (error) throw error;
  revalidatePath("/work-orders");
  revalidatePath(`/work-orders/${id}`);
}

export async function deleteWorkOrder(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("work_orders").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/work-orders");
}
