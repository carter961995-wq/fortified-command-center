import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { money, type PlainRow } from "../../../../../lib/business";
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

function wrap(input: string, max = 78) {
  const words = input.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return new NextResponse("Supabase is not configured.", { status: 500 });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await context.params;
  const [{ data: invoice, error }, { data: items }] = await Promise.all([
    supabase.from("invoices").select("*, customers(*), locations(*), work_orders(*)").eq("id", id).maybeSingle(),
    supabase.from("invoice_line_items").select("*").eq("invoice_id", id).order("created_at", { ascending: true })
  ]);
  if (error) return new NextResponse(error.message, { status: 400 });
  if (!invoice) return new NextResponse("Invoice not found.", { status: 404 });

  const inv = invoice as PlainRow;
  const customer = nested(inv, "customers");
  const location = nested(inv, "locations");
  const workOrder = nested(inv, "work_orders");
  const lineItems = (items ?? []) as PlainRow[];

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const amber = rgb(0.68, 0.31, 0.04);
  const dark = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.35, 0.35, 0.35);
  let y = 742;

  page.drawRectangle({ x: 0, y: 720, width: 612, height: 72, color: rgb(0.08, 0.08, 0.08) });
  page.drawText("FORTIFIED FENCE & WELD", { x: 42, y: 758, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Commercial fence, gate, welding, security grille, bollard & facilities maintenance", { x: 42, y: 738, size: 9, font: regular, color: rgb(0.9, 0.86, 0.76) });
  page.drawText("(318) 446-2134", { x: 440, y: 752, size: 13, font: bold, color: rgb(1, 1, 1) });
  page.drawText("INVOICE", { x: 430, y: 690, size: 34, font: bold, color: amber });

  y = 672;
  page.drawText("Bill To", { x: 42, y, size: 12, font: bold, color: dark });
  page.drawText(text(customer.company_name), { x: 42, y: y - 18, size: 10, font: regular, color: dark });
  page.drawText(text(customer.contact_name), { x: 42, y: y - 33, size: 10, font: regular, color: dark });
  wrap(text(customer.billing_address), 42).slice(0, 3).forEach((line, index) => page.drawText(line, { x: 42, y: y - 48 - index * 14, size: 9, font: regular, color: muted }));
  page.drawText(text(customer.billing_email || customer.contact_email), { x: 42, y: y - 92, size: 9, font: regular, color: muted });

  const details = [
    ["Invoice #", inv.invoice_number],
    ["Customer WO #", workOrder.customer_work_order_number],
    ["Purchase Order #", workOrder.purchase_order_number],
    ["Invoice Date", inv.invoice_date],
    ["Due Date", inv.due_date],
    ["Terms", inv.payment_terms || customer.payment_terms || "Net 14"]
  ];
  details.forEach(([label, value], index) => {
    const rowY = 660 - index * 18;
    page.drawText(String(label), { x: 360, y: rowY, size: 9, font: bold, color: muted });
    page.drawText(text(value), { x: 462, y: rowY, size: 9, font: regular, color: dark });
  });

  y = 540;
  page.drawText("Job Location", { x: 42, y, size: 12, font: bold, color: dark });
  const locationLine = [location.location_name, location.address_line_1, location.city, location.state, location.zip].filter(Boolean).join(", ");
  page.drawText(locationLine || "-", { x: 42, y: y - 18, size: 9, font: regular, color: dark });
  page.drawText("Service Summary", { x: 42, y: y - 48, size: 12, font: bold, color: dark });
  wrap(text(workOrder.title), 90).slice(0, 2).forEach((line, index) => page.drawText(line, { x: 42, y: y - 66 - index * 14, size: 9, font: regular, color: dark }));
  page.drawText("Detailed Work Scope", { x: 42, y: y - 104, size: 12, font: bold, color: dark });
  wrap(text(workOrder.scope_summary || inv.notes), 95).slice(0, 5).forEach((line, index) => page.drawText(line, { x: 42, y: y - 122 - index * 14, size: 9, font: regular, color: muted }));

  y = 335;
  page.drawRectangle({ x: 42, y, width: 528, height: 24, color: rgb(0.93, 0.9, 0.84) });
  page.drawText("Description", { x: 52, y: y + 8, size: 9, font: bold, color: dark });
  page.drawText("Amount", { x: 500, y: y + 8, size: 9, font: bold, color: dark });
  y -= 22;
  const rows = lineItems.length ? lineItems : [{ description: workOrder.title || "Services rendered", total: inv.subtotal || inv.total_amount }];
  rows.slice(0, 9).forEach((item) => {
    page.drawText(text(item.description).slice(0, 80), { x: 52, y, size: 9, font: regular, color: dark });
    page.drawText(money(item.total), { x: 500, y, size: 9, font: regular, color: dark });
    y -= 18;
  });

  y = 130;
  const totals = [["Subtotal", inv.subtotal], ["Tax", inv.tax_amount], ["Total Due", inv.balance_due ?? inv.total_amount]];
  totals.forEach(([label, value], index) => {
    const totalY = y - index * 20;
    page.drawText(String(label), { x: 410, y: totalY, size: index === 2 ? 12 : 10, font: bold, color: index === 2 ? amber : dark });
    page.drawText(money(value), { x: 500, y: totalY, size: index === 2 ? 12 : 10, font: bold, color: index === 2 ? amber : dark });
  });
  page.drawText(`Notes: ${text(inv.notes)}`, { x: 42, y: 96, size: 9, font: regular, color: muted });
  page.drawText("Thank you for your business. Page 1", { x: 42, y: 52, size: 9, font: bold, color: dark });
  page.drawText("Professional commercial service by Fortified Fence & Weld", { x: 342, y: 52, size: 8, font: regular, color: muted });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${text(inv.invoice_number)}.pdf"`
    }
  });
}
