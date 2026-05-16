"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getSubcontractors() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subcontractors")
    .select("*")
    .order("company_name");
  if (error) throw error;
  return data;
}

export async function getSubcontractor(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subcontractors")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createSubcontractor(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("subcontractors").insert({
    company_name: formData.get("company_name") as string,
    owner_name: formData.get("owner_name") as string,
    phone: formData.get("phone") as string,
    email: (formData.get("email") as string) || null,
    service_states: JSON.parse((formData.get("service_states") as string) || "[]"),
    service_radius_miles: parseInt(formData.get("service_radius_miles") as string) || null,
    trades: JSON.parse((formData.get("trades") as string) || "[]"),
    insurance_expiration: (formData.get("insurance_expiration") as string) || null,
    w9_received: formData.get("w9_received") === "true",
    coi_received: formData.get("coi_received") === "true",
    agreement_signed: formData.get("agreement_signed") === "true",
    is_preferred: formData.get("is_preferred") === "true",
    dedicated_region: (formData.get("dedicated_region") as string) || null,
    labor_rate_per_hour: parseFloat(formData.get("labor_rate_per_hour") as string) || null,
    trip_charge: parseFloat(formData.get("trip_charge") as string) || null,
    status: (formData.get("status") as string) || "Pending",
    notes: (formData.get("notes") as string) || null,
  });
  if (error) throw error;
  revalidatePath("/subcontractors");
}

export async function updateSubcontractor(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("subcontractors")
    .update({
      company_name: formData.get("company_name") as string,
      owner_name: formData.get("owner_name") as string,
      phone: formData.get("phone") as string,
      email: (formData.get("email") as string) || null,
      service_states: JSON.parse((formData.get("service_states") as string) || "[]"),
      service_radius_miles: parseInt(formData.get("service_radius_miles") as string) || null,
      trades: JSON.parse((formData.get("trades") as string) || "[]"),
      insurance_expiration: (formData.get("insurance_expiration") as string) || null,
      w9_received: formData.get("w9_received") === "true",
      coi_received: formData.get("coi_received") === "true",
      agreement_signed: formData.get("agreement_signed") === "true",
      is_preferred: formData.get("is_preferred") === "true",
      dedicated_region: (formData.get("dedicated_region") as string) || null,
      labor_rate_per_hour: parseFloat(formData.get("labor_rate_per_hour") as string) || null,
      trip_charge: parseFloat(formData.get("trip_charge") as string) || null,
      status: (formData.get("status") as string) || "Pending",
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/subcontractors");
  revalidatePath(`/subcontractors/${id}`);
}

export async function deleteSubcontractor(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("subcontractors").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/subcontractors");
}
