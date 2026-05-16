"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { subcontractorSchema } from "@/lib/schemas";

function emptyToNull(v: unknown) {
  if (v === "" || v === undefined) return null;
  return v;
}

function splitList(v: unknown) {
  if (!v || typeof v !== "string") return [] as string[];
  return v
    .split(/[,|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createSubcontractor(formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const raw = Object.fromEntries(formData.entries());
  const parsed = subcontractorSchema.safeParse({
    ...raw,
    email: emptyToNull(raw.email),
  });
  if (!parsed.success) return;

  const row = {
    ...parsed.data,
    service_states: splitList(String(raw.service_states ?? "")),
    trades: splitList(String(raw.trades ?? "")),
  };

  const { data, error } = await supabase.from("subcontractors").insert(row).select("id").single();
  if (error) return;
  revalidatePath("/subcontractors");
  redirect(`/subcontractors/${data.id}`);
}

export async function updateSubcontractor(id: string, formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const raw = Object.fromEntries(formData.entries());
  const parsed = subcontractorSchema.safeParse({
    ...raw,
    email: emptyToNull(raw.email),
  });
  if (!parsed.success) return;

  const row = {
    ...parsed.data,
    service_states: splitList(String(raw.service_states ?? "")),
    trades: splitList(String(raw.trades ?? "")),
  };

  const { error } = await supabase.from("subcontractors").update(row).eq("id", id);
  if (error) return;
  revalidatePath("/subcontractors");
  revalidatePath(`/subcontractors/${id}`);
}
