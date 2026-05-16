"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/require-staff";
import { recalcInvoicePayments } from "@/lib/invoice-sync";
import { paymentMethods } from "@/lib/schemas";
import { z } from "zod";

const paySchema = z.object({
  invoice_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  payment_date: z.string().min(1),
  payment_method: paymentMethods,
  reference_number: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function addPayment(formData: FormData): Promise<void> {
  const { supabase } = await requireStaff();
  const raw = Object.fromEntries(formData.entries());
  const parsed = paySchema.safeParse({
    ...raw,
    reference_number: raw.reference_number || null,
    notes: raw.notes || null,
  });
  if (!parsed.success) return;

  const { error } = await supabase.from("payments").insert(parsed.data);
  if (error) return;

  await recalcInvoicePayments(supabase, parsed.data.invoice_id);

  const { data: inv } = await supabase.from("invoices").select("work_order_id").eq("id", parsed.data.invoice_id).single();
  revalidatePath(`/invoices/${parsed.data.invoice_id}`);
  if (inv?.work_order_id) revalidatePath(`/work-orders/${inv.work_order_id}`);
}
