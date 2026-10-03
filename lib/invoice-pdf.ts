import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { money } from "./business.ts";

export type InvoicePdfInput = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  terms: string;
  customerName: string;
  contactName: string;
  billingAddress: string;
  billingEmail: string;
  customerWorkOrder: string;
  purchaseOrder: string;
  locationLine: string;
  title: string;
  scope: string;
  notes: string;
  subtotal: unknown;
  tax: unknown;
  totalDue: unknown;
  items: { description: string; total: unknown }[];
};

export function wrapPdfText(input: string, max = 90) {
  const lines: string[] = [];
  for (const rawLine of input.split(/\r?\n/)) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const pieces = word.length > max ? word.match(new RegExp(`.{1,${max}}`, "g")) ?? [word] : [word];
      for (const piece of pieces) {
        const next = `${line} ${piece}`.trim();
        if (next.length > max) {
          if (line) lines.push(line);
          line = piece;
        } else {
          line = next;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function invoicePdfLines(input: InvoicePdfInput) {
  const items = input.items.length ? input.items : [{ description: input.title || "Services rendered", total: input.subtotal }];
  return [
    input.invoiceNumber,
    input.customerWorkOrder,
    input.purchaseOrder,
    input.customerName,
    input.contactName,
    input.billingAddress,
    input.billingEmail,
    input.locationLine,
    input.title,
    input.scope,
    input.notes,
    ...items.map((item) => item.description),
  ].flatMap((value) => String(value ?? "").split(/\r?\n/)).map((line) => line.trim()).filter(Boolean);
}

function ascii(value: string) {
  return value.replace(/[^\x20-\x7E\n]/g, " ");
}

export async function renderInvoicePdf(input: InvoicePdfInput) {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const amber = rgb(0.68, 0.31, 0.04);
  const dark = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.35, 0.35, 0.35);
  const pages: PDFPage[] = [];
  let page = pdf.addPage([612, 792]);
  pages.push(page);
  let y = 680;

  const newPage = () => {
    page = pdf.addPage([612, 792]);
    pages.push(page);
    y = 680;
    drawHeader();
  };
  const ensure = (height: number) => {
    if (y - height < 72) newPage();
  };
  const draw = (text: string, options: { x?: number; size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number }) => {
    const size = options.size ?? 9;
    const gap = options.gap ?? 14;
    const line = ascii(text).slice(0, 240);
    ensure(gap);
    page.drawText(line, { x: options.x ?? 42, y, size, font: options.font ?? regular, color: options.color ?? dark });
    y -= gap;
  };
  const drawHeader = () => {
    page.drawRectangle({ x: 0, y: 720, width: 612, height: 72, color: rgb(0.08, 0.08, 0.08) });
    page.drawText("FORTIFIED FENCE & WELD", { x: 42, y: 758, size: 16, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Commercial fence, gate, welding, and facilities maintenance", { x: 42, y: 740, size: 9, font: regular, color: rgb(0.9, 0.86, 0.76) });
    page.drawText("(318) 446-2134", { x: 440, y: 752, size: 12, font: bold, color: rgb(1, 1, 1) });
    y = 690;
    draw("INVOICE", { size: 22, font: bold, color: amber, gap: 28 });
  };

  drawHeader();
  draw("Bill To", { size: 12, font: bold, gap: 16 });
  draw(input.customerName || "-", { gap: 13 });
  draw(input.contactName || "-", { gap: 13 });
  wrapPdfText(input.billingAddress || "-", 70).forEach((line) => draw(line, { color: muted, gap: 12 }));
  draw(input.billingEmail || "-", { color: muted, gap: 16 });

  const details = [
    ["Invoice #", input.invoiceNumber],
    ["Customer WO #", input.customerWorkOrder],
    ["Purchase Order #", input.purchaseOrder],
    ["Invoice Date", input.invoiceDate],
    ["Due Date", input.dueDate],
    ["Terms", input.terms],
  ];
  details.forEach(([label, value]) => draw(`${label}: ${value || "-"}`, { gap: 13 }));

  draw("Job Location", { size: 12, font: bold, gap: 16 });
  wrapPdfText(input.locationLine || "-", 90).forEach((line) => draw(line, { gap: 12 }));
  draw("Service Summary", { size: 12, font: bold, gap: 16 });
  wrapPdfText(input.title || "-", 90).forEach((line) => draw(line, { gap: 12 }));
  draw("Detailed Work Scope", { size: 12, font: bold, gap: 16 });
  wrapPdfText(input.scope || "-", 95).forEach((line) => draw(line, { color: muted, gap: 12 }));

  ensure(28);
  page.drawRectangle({ x: 42, y: y - 6, width: 528, height: 20, color: rgb(0.93, 0.9, 0.84) });
  page.drawText("Description", { x: 52, y, size: 9, font: bold, color: dark });
  page.drawText("Amount", { x: 490, y, size: 9, font: bold, color: dark });
  y -= 24;

  const items = input.items.length ? input.items : [{ description: input.title || "Services rendered", total: input.subtotal }];
  for (const item of items) {
    const lines = wrapPdfText(String(item.description || "-"), 78);
    lines.forEach((line, index) => {
      ensure(16);
      page.drawText(ascii(line), { x: 52, y, size: 9, font: regular, color: dark });
      if (index === 0) page.drawText(money(item.total), { x: 470, y, size: 9, font: regular, color: dark });
      y -= 14;
    });
    y -= 4;
  }

  y -= 8;
  const totals = [
    ["Subtotal", input.subtotal],
    ["Tax", input.tax],
    ["Total Due", input.totalDue],
  ] as const;
  totals.forEach(([label, value], index) => {
    ensure(20);
    const emphasis = index === totals.length - 1;
    page.drawText(label, { x: 360, y, size: emphasis ? 12 : 10, font: bold, color: emphasis ? amber : dark });
    page.drawText(money(value), { x: 470, y, size: emphasis ? 12 : 10, font: bold, color: emphasis ? amber : dark });
    y -= 18;
  });

  draw("Notes", { size: 12, font: bold, gap: 16 });
  wrapPdfText(input.notes || "-", 95).forEach((line) => draw(line, { color: muted, gap: 12 }));

  pages.forEach((item, index) => {
    item.drawText(`Thank you for your business. Page ${index + 1} of ${pages.length}`, { x: 42, y: 42, size: 9, font: bold, color: dark });
    item.drawText("Professional commercial service by Fortified Fence & Weld", { x: 300, y: 28, size: 8, font: regular, color: muted });
  });

  return pdf.save();
}
