"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getJobCosts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_costs")
    .select("*, work_order:work_orders(id, title)")
    .order("date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createJobCost(formData: FormData) {
  const supabase = await createClient();
  const workOrderId = formData.get("work_order_id") as string;
  const { error } = await supabase.from("job_costs").insert({
    work_order_id: workOrderId,
    category: formData.get("category") as string,
    description: formData.get("description") as string,
    amount: parseFloat(formData.get("amount") as string),
    vendor_name: (formData.get("vendor_name") as string) || null,
    date: (formData.get("date") as string) || new Date().toISOString().split("T")[0],
  });
  if (error) throw error;
  revalidatePath("/job-costs");
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function deleteJobCost(id: string, workOrderId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("job_costs").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/job-costs");
  revalidatePath(`/work-orders/${workOrderId}`);
}
