import { invoiceStatusFromBalance, type PlainRow } from "./business.ts";
import { parseAdjustmentMoney, parsePositiveMoney } from "./money.ts";

type DataClient = { from: (table: string) => any };

async function syncInvoiceTotals(client: DataClient, invoiceId: string) {
  const [{ data: invoice, error: invoiceError }, { data: lineItems, error: lineError }, { data: payments, error: paymentError }] = await Promise.all([
    client.from("invoices").select("total_amount, tax_amount, due_date, paid_at").eq("id", invoiceId).maybeSingle(),
    client.from("invoice_line_items").select("total").eq("invoice_id", invoiceId),
    client.from("payments").select("amount").eq("invoice_id", invoiceId),
  ]);
  if (invoiceError || lineError || paymentError) {
    throw new Error(invoiceError?.message || lineError?.message || paymentError?.message || "Could not read invoice totals.");
  }
  const subtotal = ((lineItems ?? []) as PlainRow[]).reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const tax = Number((invoice as PlainRow | null)?.tax_amount ?? 0);
  const total = subtotal > 0 ? subtotal + tax : Number((invoice as PlainRow | null)?.total_amount ?? 0);
  const amountPaid = Math.round(((payments ?? []) as PlainRow[]).reduce((sum, row) => sum + Number(row.amount ?? 0), 0) * 100) / 100;
  const status = invoiceStatusFromBalance(total, amountPaid, (invoice as PlainRow | null)?.due_date ? String((invoice as PlainRow).due_date) : null);
  const balanceDue = Math.max(Math.round((total - amountPaid) * 100) / 100, 0);
  const updates: PlainRow = { subtotal, total_amount: total, amount_paid: amountPaid, balance_due: balanceDue, status };
  if (status === "paid" && !(invoice as PlainRow | null)?.paid_at) updates.paid_at = new Date().toISOString();
  const { error } = await client.from("invoices").update(updates).eq("id", invoiceId);
  if (error) throw new Error(error.message);
  return updates;
}

async function insertMoneyRow(
  client: DataClient,
  invoiceId: string,
  customerId: string,
  amount: number,
  formData: FormData,
  notes: string | null
) {
  const payload = {
    invoice_id: invoiceId,
    customer_id: customerId,
    amount,
    payment_date: String(formData.get("payment_date") ?? new Date().toISOString().slice(0, 10)),
    payment_method: String(formData.get("payment_method") ?? "other"),
    reference_number: String(formData.get("reference_number") ?? "") || null,
    notes,
  };
  const inserted = await client.from("payments").insert(payload).select("id").maybeSingle();
  if (inserted?.error || !inserted?.data?.id) {
    throw new Error(inserted?.error?.message || "Payment was not recorded.");
  }
  const paymentId = String(inserted.data.id);
  try {
    await syncInvoiceTotals(client, invoiceId);
  } catch (error) {
    await client.from("payments").delete().eq("id", paymentId);
    throw error;
  }
  return paymentId;
}

export async function recordPayment(client: DataClient, invoiceId: string, customerId: string, formData: FormData) {
  const parsed = parsePositiveMoney(formData.get("amount"));
  if (!parsed.ok) return { ok: false as const, error: parsed.error };
  const paymentId = await insertMoneyRow(client, invoiceId, customerId, parsed.amount, formData, String(formData.get("notes") ?? "") || null);
  return { ok: true as const, paymentId, amount: parsed.amount };
}

export async function recordAdjustment(client: DataClient, invoiceId: string, customerId: string, formData: FormData) {
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) return { ok: false as const, error: "An adjustment needs a short reason." };
  const parsed = parseAdjustmentMoney(formData.get("amount"));
  if (!parsed.ok) return { ok: false as const, error: parsed.error };
  const paymentId = await insertMoneyRow(client, invoiceId, customerId, parsed.amount, formData, `Adjustment: ${reason}`);
  return { ok: true as const, paymentId, amount: parsed.amount };
}

export { syncInvoiceTotals };
