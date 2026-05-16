"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getLocations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*, customer:customers(id, company_name)")
    .order("name");
  if (error) throw error;
  return data;
}

export async function getLocation(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*, customer:customers(id, company_name)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getLocationsByCustomer(customerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("customer_id", customerId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data;
}

export async function createLocation(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("locations").insert({
    customer_id: formData.get("customer_id") as string,
    name: formData.get("name") as string,
    address_line1: formData.get("address_line1") as string,
    address_line2: (formData.get("address_line2") as string) || null,
    city: formData.get("city") as string,
    state: formData.get("state") as string,
    zip: formData.get("zip") as string,
    gate_code: (formData.get("gate_code") as string) || null,
    access_instructions: (formData.get("access_instructions") as string) || null,
    site_contact_name: (formData.get("site_contact_name") as string) || null,
    site_contact_phone: (formData.get("site_contact_phone") as string) || null,
    notes: (formData.get("notes") as string) || null,
  });
  if (error) throw error;
  revalidatePath("/locations");
}

export async function updateLocation(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("locations")
    .update({
      customer_id: formData.get("customer_id") as string,
      name: formData.get("name") as string,
      address_line1: formData.get("address_line1") as string,
      address_line2: (formData.get("address_line2") as string) || null,
      city: formData.get("city") as string,
      state: formData.get("state") as string,
      zip: formData.get("zip") as string,
      gate_code: (formData.get("gate_code") as string) || null,
      access_instructions: (formData.get("access_instructions") as string) || null,
      site_contact_name: (formData.get("site_contact_name") as string) || null,
      site_contact_phone: (formData.get("site_contact_phone") as string) || null,
      notes: (formData.get("notes") as string) || null,
      is_active: formData.get("is_active") === "true",
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/locations");
  revalidatePath(`/locations/${id}`);
}

export async function deleteLocation(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("locations").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/locations");
}
