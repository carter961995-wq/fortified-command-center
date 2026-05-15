"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { workOrderSchema, workOrderStatuses } from "@/lib/schemas";
import { nextWorkOrderNumber } from "@/lib/document-numbers";
import { z } from "zod";

function emptyToNull(v: unknown) {
  if (v === "" || v === undefined) return null;
  return v;
}

export async function createWorkOrder(formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const raw = Object.fromEntries(formData.entries());
  const parsed = workOrderSchema.safeParse({
    ...raw,
    subcontractor_id:
      raw.subcontractor_id && String(raw.subcontractor_id).length > 0
        ? String(raw.subcontractor_id)
        : null,
    requested_date: emptyToNull(raw.requested_date),
    due_date: emptyToNull(raw.due_date),
    scheduled_date: emptyToNull(raw.scheduled_date),
  });
  if (!parsed.success) return;

  const work_order_number = await nextWorkOrderNumber(supabase);
  const { data, error } = await supabase
    .from("work_orders")
    .insert({ ...parsed.data, work_order_number })
    .select("id")
    .single();
  if (error) return;
  revalidatePath("/work-orders");
  redirect(`/work-orders/${data.id}`);
}

export async function updateWorkOrder(id: string, formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const raw = Object.fromEntries(formData.entries());
  const parsed = workOrderSchema.safeParse({
    ...raw,
    subcontractor_id:
      raw.subcontractor_id && String(raw.subcontractor_id).length > 0
        ? String(raw.subcontractor_id)
        : null,
    requested_date: emptyToNull(raw.requested_date),
    due_date: emptyToNull(raw.due_date),
    scheduled_date: emptyToNull(raw.scheduled_date),
  });
  if (!parsed.success) return;
  const { error } = await supabase.from("work_orders").update(parsed.data).eq("id", id);
  if (error) return;
  revalidatePath("/work-orders");
  revalidatePath(`/work-orders/${id}`);
}

export async function updateWorkOrderStatus(id: string, formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const status = String(formData.get("status") ?? "");
  const s = workOrderStatuses.safeParse(status);
  if (!s.success) return;
  const { error } = await supabase.from("work_orders").update({ status: s.data }).eq("id", id);
  if (error) return;
  revalidatePath("/work-orders");
  revalidatePath(`/work-orders/${id}`);
}

const jobCostSchema = z.object({
  work_order_id: z.string().uuid(),
  subcontractor_id: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
  cost_type: z.enum(["subcontractor", "materials", "equipment", "travel", "permit", "other"]),
  description: z.string().min(1),
  amount: z.coerce.number(),
  paid: z.coerce.boolean().optional(),
});

export async function addJobCost(formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const raw = Object.fromEntries(formData.entries());
  const parsed = jobCostSchema.safeParse({
    ...raw,
    subcontractor_id:
      raw.subcontractor_id && String(raw.subcontractor_id).length > 0
        ? String(raw.subcontractor_id)
        : null,
    paid: raw.paid === "on" || raw.paid === "true",
  });
  if (!parsed.success) return;
  const { error } = await supabase.from("job_costs").insert({
    work_order_id: parsed.data.work_order_id,
    subcontractor_id: parsed.data.subcontractor_id ?? null,
    cost_type: parsed.data.cost_type,
    description: parsed.data.description,
    amount: parsed.data.amount,
    paid: parsed.data.paid ?? false,
  });
  if (error) return;
  revalidatePath(`/work-orders/${parsed.data.work_order_id}`);
}

export async function deleteJobCost(id: string, workOrderId: string): Promise<void> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("job_costs").delete().eq("id", id);
  if (error) return;
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function addWorkOrderPhoto(formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const work_order_id = String(formData.get("work_order_id") ?? "");
  const photo_url = String(formData.get("photo_url") ?? "");
  const photo_type = String(formData.get("photo_type") ?? "other");
  const caption = emptyToNull(formData.get("caption"));
  if (!work_order_id || !photo_url) return;
  const { error } = await supabase.from("work_order_photos").insert({
    work_order_id,
    photo_url,
    photo_type,
    caption: caption as string | null,
    uploaded_by: "admin",
  });
  if (error) return;
  revalidatePath(`/work-orders/${work_order_id}`);
}

export async function addWorkOrderDocument(formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const work_order_id = String(formData.get("work_order_id") ?? "");
  const document_url = String(formData.get("document_url") ?? "");
  const document_type = String(formData.get("document_type") ?? "other");
  const filename = emptyToNull(formData.get("filename"));
  if (!work_order_id || !document_url) return;
  const { error } = await supabase.from("work_order_documents").insert({
    work_order_id,
    document_url,
    document_type,
    filename: filename as string | null,
    uploaded_by: "admin",
  });
  if (error) return;
  revalidatePath(`/work-orders/${work_order_id}`);
}
