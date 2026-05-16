import type { SupabaseClient } from "@supabase/supabase-js";

export async function nextWorkOrderNumber(supabase: SupabaseClient) {
  const y = new Date().getFullYear();
  const { count } = await supabase.from("work_orders").select("id", { count: "exact", head: true });
  const n = (count ?? 0) + 1;
  return `WO-${y}-${String(n).padStart(4, "0")}`;
}

export async function nextQuoteNumber(supabase: SupabaseClient) {
  const y = new Date().getFullYear();
  const { count } = await supabase.from("quotes").select("id", { count: "exact", head: true });
  const n = (count ?? 0) + 1;
  return `Q-${y}-${String(n).padStart(4, "0")}`;
}

export async function nextInvoiceNumber(supabase: SupabaseClient) {
  const y = new Date().getFullYear();
  const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true });
  const n = (count ?? 0) + 1;
  return `INV-${y}-${String(n).padStart(4, "0")}`;
}
