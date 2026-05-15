import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function recalcInvoicePayments(supabase: SupabaseClient, invoiceId: string) {
  const { data: inv } = await supabase
    .from("invoices")
    .select("total_amount, due_date, status, work_order_id")
    .eq("id", invoiceId)
    .single();
  if (!inv || inv.status === "void") return;

  const { data: pays } = await supabase.from("payments").select("amount").eq("invoice_id", invoiceId);
  const paid = (pays ?? []).reduce((a, p) => a + Number(p.amount ?? 0), 0);
  const total = Number(inv.total_amount ?? 0);
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);

  let status = inv.status as string;
  if (inv.status === "draft") {
    status = "draft";
  } else if (balance <= 0 && total > 0) {
    status = "paid";
  } else if (paid > 0 && balance > 0) {
    status = "partially_paid";
  } else if (inv.due_date && new Date(`${inv.due_date}T12:00:00`) < new Date() && balance > 0) {
    status = "overdue";
  }

  const patch: Record<string, unknown> = {
    amount_paid: paid,
    balance_due: balance,
    status,
  };
  if (status === "paid") {
    patch.paid_at = new Date().toISOString();
  }

  await supabase.from("invoices").update(patch).eq("id", invoiceId);

  if (inv.work_order_id && status === "paid") {
    await supabase
      .from("work_orders")
      .update({ status: "Paid", paid_at: new Date().toISOString() })
      .eq("id", inv.work_order_id);
    revalidatePath(`/work-orders/${inv.work_order_id}`);
  }
}
