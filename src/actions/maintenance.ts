"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import {
  billingFrequencies,
  inspectionFrequencies,
  maintenanceContractStatuses,
  maintenancePlanTypes,
} from "@/lib/schemas";
import { z } from "zod";

const contractSchema = z.object({
  customer_id: z.string().uuid(),
  location_id: z.union([z.string().uuid(), z.literal("")]).optional(),
  contract_name: z.string().min(1),
  plan_type: maintenancePlanTypes,
  status: maintenanceContractStatuses,
  start_date: z.string().min(1),
  end_date: z.string().optional().nullable(),
  billing_frequency: billingFrequencies,
  recurring_amount: z.coerce.number(),
  inspection_frequency: inspectionFrequencies,
  included_services: z.string().optional().nullable(),
  excluded_services: z.string().optional().nullable(),
  priority_dispatch: z.coerce.boolean().optional(),
  discount_percent: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function createMaintenanceContract(formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const raw = Object.fromEntries(formData.entries());
  const parsed = contractSchema.safeParse({
    ...raw,
    location_id: raw.location_id && String(raw.location_id).length > 0 ? String(raw.location_id) : null,
    end_date: raw.end_date && String(raw.end_date).length > 0 ? String(raw.end_date) : null,
    priority_dispatch: raw.priority_dispatch === "on",
    discount_percent:
      raw.discount_percent === "" || raw.discount_percent === undefined ? null : Number(raw.discount_percent),
  });
  if (!parsed.success) return;

  const { data, error } = await supabase
    .from("maintenance_contracts")
    .insert({
      ...parsed.data,
      location_id: parsed.data.location_id ?? null,
      end_date: parsed.data.end_date ?? null,
    })
    .select("id")
    .single();
  if (error) return;
  revalidatePath("/maintenance-contracts");
  revalidatePath(`/customers/${parsed.data.customer_id}`);
  redirect(`/maintenance-contracts/${data.id}`);
}

function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

export async function generateMaintenanceVisitsFromForm(formData: FormData): Promise<void> {
  const contractId = String(formData.get("contract_id") ?? "");
  if (!contractId) return;
  await generateMaintenanceVisits(contractId);
}

async function generateMaintenanceVisits(contractId: string): Promise<void> {
  const { supabase } = await requireStaff();
  const { data: c, error } = await supabase.from("maintenance_contracts").select("*").eq("id", contractId).single();
  if (error || !c) return;

  const freq = c.inspection_frequency as string;
  const step =
    freq === "monthly" ? 1 : freq === "quarterly" ? 3 : freq === "semiannual" ? 6 : 12;

  const start = new Date(`${c.start_date}T12:00:00`);
  const end = c.end_date ? new Date(`${c.end_date}T12:00:00`) : addMonths(start, 12);

  const rows: { maintenance_contract_id: string; scheduled_date: string; status: string }[] = [];
  for (let d = new Date(start); d <= end; d = addMonths(d, step)) {
    rows.push({
      maintenance_contract_id: contractId,
      scheduled_date: d.toISOString().slice(0, 10),
      status: "scheduled",
    });
  }

  if (rows.length) {
    const { error: insErr } = await supabase.from("maintenance_visits").insert(rows);
    if (insErr) return;
  }

  revalidatePath(`/maintenance-contracts/${contractId}`);
}

export async function linkVisitToWorkOrder(visitId: string, formData: FormData): Promise<void> {
  const workOrderId = String(formData.get("work_order_id") ?? "").trim();
  if (!workOrderId) return;
  const { supabase } = await requireStaff();
  const { error } = await supabase
    .from("maintenance_visits")
    .update({ work_order_id: workOrderId })
    .eq("id", visitId);
  if (error) return;
  const { data: v } = await supabase.from("maintenance_visits").select("maintenance_contract_id").eq("id", visitId).single();
  if (v?.maintenance_contract_id) {
    revalidatePath(`/maintenance-contracts/${v.maintenance_contract_id}`);
  }
  revalidatePath(`/work-orders/${workOrderId}`);
}
