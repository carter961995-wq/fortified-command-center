"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getCustomers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("company_name");
  if (error) throw error;
  return data;
}

export async function getCustomer(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createCustomer(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert({
    company_name: formData.get("company_name") as string,
    contact_name: formData.get("contact_name") as string,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    billing_address_line1: (formData.get("billing_address_line1") as string) || null,
    billing_address_line2: (formData.get("billing_address_line2") as string) || null,
    billing_city: (formData.get("billing_city") as string) || null,
    billing_state: (formData.get("billing_state") as string) || null,
    billing_zip: (formData.get("billing_zip") as string) || null,
    payment_terms_days: parseInt(formData.get("payment_terms_days") as string) || 14,
    tax_exempt: formData.get("tax_exempt") === "true",
    tax_rate: parseFloat(formData.get("tax_rate") as string) || 0,
    notes: (formData.get("notes") as string) || null,
  });
  if (error) throw error;
  revalidatePath("/customers");
}

export async function updateCustomer(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      company_name: formData.get("company_name") as string,
      contact_name: formData.get("contact_name") as string,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      billing_address_line1: (formData.get("billing_address_line1") as string) || null,
      billing_address_line2: (formData.get("billing_address_line2") as string) || null,
      billing_city: (formData.get("billing_city") as string) || null,
      billing_state: (formData.get("billing_state") as string) || null,
      billing_zip: (formData.get("billing_zip") as string) || null,
      payment_terms_days: parseInt(formData.get("payment_terms_days") as string) || 14,
      tax_exempt: formData.get("tax_exempt") === "true",
      tax_rate: parseFloat(formData.get("tax_rate") as string) || 0,
      notes: (formData.get("notes") as string) || null,
      is_active: formData.get("is_active") === "true",
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/customers");
}
