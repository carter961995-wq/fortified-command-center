import { NextResponse } from "next/server";
import { type PlainRow } from "../../../../../lib/business";
import { renderInvoicePdf } from "../../../../../lib/invoice-pdf";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

function nested(row: PlainRow, key: string) {
  const value = row[key];
  if (Array.isArray(value)) return (value[0] ?? {}) as PlainRow;
  if (value && typeof value === "object") return value as PlainRow;
  return {} as PlainRow;
}

function text(value: unknown) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return new NextResponse("Supabase is not configured.", { status: 500 });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await context.params;
  const [{ data: invoice, error }, { data: items }] = await Promise.all([
    supabase.from("invoices").select("*, customers(*), locations(*), work_orders(*)").eq("id", id).maybeSingle(),
    supabase.from("invoice_line_items").select("*").eq("invoice_id", id).order("created_at", { ascending: true }),
  ]);
  if (error) return new NextResponse(error.message, { status: 400 });
  if (!invoice) return new NextResponse("Invoice not found.", { status: 404 });

  const inv = invoice as PlainRow;
  const customer = nested(inv, "customers");
  const location = nested(inv, "locations");
  const workOrder = nested(inv, "work_orders");
  const lineItems = ((items ?? []) as PlainRow[]).map((item) => ({
    description: text(item.description),
    total: item.total,
  }));
  const locationLine = [location.location_name, location.address_line_1, location.address_line_2, location.city, location.state, location.zip]
    .filter(Boolean)
    .join(", ");

  const bytes = await renderInvoicePdf({
    invoiceNumber: text(inv.invoice_number),
    invoiceDate: text(inv.invoice_date),
    dueDate: text(inv.due_date),
    terms: text(inv.payment_terms || customer.payment_terms || "Net 14"),
    customerName: text(customer.company_name),
    contactName: text(customer.contact_name),
    billingAddress: text(customer.billing_address),
    billingEmail: text(customer.billing_email || customer.contact_email),
    customerWorkOrder: text(workOrder.customer_work_order_number),
    purchaseOrder: text(workOrder.purchase_order_number),
    locationLine,
    title: text(workOrder.title),
    scope: text(workOrder.scope_summary || inv.notes),
    notes: text(inv.notes),
    subtotal: inv.subtotal,
    tax: inv.tax_amount,
    totalDue: inv.balance_due ?? inv.total_amount,
    items: lineItems,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${text(inv.invoice_number)}.pdf"`,
    },
  });
}
