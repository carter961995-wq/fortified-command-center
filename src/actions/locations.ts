"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { locationSchema } from "@/lib/schemas";

function emptyToNull(v: unknown) {
  if (v === "" || v === undefined) return null;
  return v;
}

export async function createLocation(formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const raw = Object.fromEntries(formData.entries());
  const parsed = locationSchema.safeParse({
    ...raw,
    site_contact_email: emptyToNull(raw.site_contact_email),
  });
  if (!parsed.success) return;
  const { data, error } = await supabase.from("locations").insert(parsed.data).select("id").single();
  if (error) return;
  revalidatePath("/locations");
  revalidatePath(`/customers/${parsed.data.customer_id}`);
  redirect(`/locations/${data.id}`);
}

export async function updateLocation(id: string, formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const raw = Object.fromEntries(formData.entries());
  const parsed = locationSchema.safeParse({
    ...raw,
    site_contact_email: emptyToNull(raw.site_contact_email),
  });
  if (!parsed.success) return;
  const { error } = await supabase.from("locations").update(parsed.data).eq("id", id);
  if (error) return;
  revalidatePath("/locations");
  revalidatePath(`/locations/${id}`);
  revalidatePath(`/customers/${parsed.data.customer_id}`);
}
