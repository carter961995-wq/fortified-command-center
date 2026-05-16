"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { customerSchema } from "@/lib/schemas";

function emptyToNull(v: unknown) {
  if (v === "" || v === undefined) return null;
  return v;
}

export async function createCustomer(formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const raw = Object.fromEntries(formData.entries());
  const parsed = customerSchema.safeParse({
    ...raw,
    contact_email: emptyToNull(raw.contact_email),
    billing_email: emptyToNull(raw.billing_email),
  });
  if (!parsed.success) return;
  const { data, error } = await supabase.from("customers").insert(parsed.data).select("id").single();
  if (error) return;
  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(id: string, formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const raw = Object.fromEntries(formData.entries());
  const parsed = customerSchema.safeParse({
    ...raw,
    contact_email: emptyToNull(raw.contact_email),
    billing_email: emptyToNull(raw.billing_email),
  });
  if (!parsed.success) return;
  const { error } = await supabase.from("customers").update(parsed.data).eq("id", id);
  if (error) return;
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}
