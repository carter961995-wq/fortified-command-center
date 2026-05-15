"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getMaintenanceContracts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_contracts")
    .select("*, customer:customers(id, company_name), location:locations(id, name, city, state)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMaintenanceContract(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_contracts")
    .select("*, customer:customers(*), location:locations(*), maintenance_visits(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createMaintenanceContract(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_contracts").insert({
    customer_id: formData.get("customer_id") as string,
    location_id: formData.get("location_id") as string,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || null,
    frequency: formData.get("frequency") as string,
    monthly_amount: parseFloat(formData.get("monthly_amount") as string),
    start_date: formData.get("start_date") as string,
    end_date: (formData.get("end_date") as string) || null,
    next_visit_date: (formData.get("next_visit_date") as string) || null,
    notes: (formData.get("notes") as string) || null,
  });
  if (error) throw error;
  revalidatePath("/maintenance-contracts");
}

export async function updateMaintenanceContract(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("maintenance_contracts")
    .update({
      customer_id: formData.get("customer_id") as string,
      location_id: formData.get("location_id") as string,
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || null,
      frequency: formData.get("frequency") as string,
      monthly_amount: parseFloat(formData.get("monthly_amount") as string),
      start_date: formData.get("start_date") as string,
      end_date: (formData.get("end_date") as string) || null,
      is_active: formData.get("is_active") === "true",
      next_visit_date: (formData.get("next_visit_date") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/maintenance-contracts");
  revalidatePath(`/maintenance-contracts/${id}`);
}
