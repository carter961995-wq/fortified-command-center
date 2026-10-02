import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { IntakeFile } from "./intake-files.ts";
import type { JobIntakeRecord } from "./job-intake.ts";

export type BrandedAssignment = {
  fortifiedWorkOrderNumber: string;
  contractorName: string;
  contractorEmail?: string;
  contractorPhone?: string;
  reason: string;
};

function money(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
}

function siteLine(record: JobIntakeRecord) {
  const parsed = record.parsed;
  return [parsed.address, parsed.city, parsed.state, parsed.zip].filter(Boolean).join(", ") || "—";
}

export function buildBrandedWorkOrderText(record: JobIntakeRecord, assignment: BrandedAssignment, files: IntakeFile[] = []) {
  const parsed = record.parsed;
  const fileLines = files.length
    ? files.map((file) => `- ${file.name}${file.sourceUrl ? ` (${file.sourceUrl})` : ""}`).join("\n")
    : "- None attached";

  return [
    "FORTIFIED FENCE & WELD",
    "WORK ORDER",
    "",
    `Fortified WO #: ${assignment.fortifiedWorkOrderNumber}`,
    `Customer WO #: ${parsed.workOrderNumber || "—"}`,
    `PO #: ${parsed.purchaseOrderNumber || "—"}`,
    `Source: ${record.source}`,
    "",
    "ASSIGNED CONTRACTOR",
    assignment.contractorName,
    assignment.contractorEmail || "",
    assignment.contractorPhone || "",
    assignment.reason,
    "",
    "JOB SITE",
    parsed.customerName || "—",
    parsed.locationName || "—",
    parsed.storeNumber ? `Store ${parsed.storeNumber}` : "",
    siteLine(record),
    "",
    "SCOPE",
    parsed.description || record.subject || "Work order",
    parsed.jobDetails || "",
    `Trade: ${parsed.tradeType || "—"}`,
    `Priority: ${parsed.priority || "—"}`,
    `Not to exceed: ${money(parsed.dneAmount)}`,
    `Timeframe: ${parsed.timeframe || "—"}`,
    `Due: ${parsed.dueDate || "—"}`,
    "",
    "SITE CONTACT",
    [parsed.contactName, parsed.contactPhone, parsed.contactEmail].filter(Boolean).join(" · ") || "—",
    "",
    "PHOTOS AND FILES",
    fileLines,
    "",
    "Complete the work within the not-to-exceed amount. Send before and after photos back to Fortified Fence & Weld before leaving the site.",
    "",
    "Fortified Fence & Weld · Field dispatch",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function brandedWorkOrderSubject(record: JobIntakeRecord, assignment: BrandedAssignment) {
  const where = [record.parsed.city, record.parsed.state].filter(Boolean).join(", ");
  return [
    `Fortified WO ${assignment.fortifiedWorkOrderNumber}`,
    where || null,
    record.parsed.description || record.subject || "New assignment",
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 180);
}

function wrapLine(text: string, width: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word.slice(0, width);
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function writeBrandedWorkOrderPdf(input: {
  directory: string;
  record: JobIntakeRecord;
  assignment: BrandedAssignment;
  files: IntakeFile[];
}) {
  await mkdir(input.directory, { recursive: true });
  const text = buildBrandedWorkOrderText(input.record, input.assignment, input.files);
  const textPath = path.join(input.directory, `${input.record.id}.txt`);
  const pdfPath = path.join(input.directory, `${input.record.id}.pdf`);
  await writeFile(textPath, text, { mode: 0o600 });

  const pdf = await PDFDocument.create();
  const pageSize: [number, number] = [612, 792];
  let page = pdf.addPage(pageSize);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 40;
  let y = 792;

  const drawHeader = () => {
    page.drawRectangle({ x: 0, y: 742, width: 612, height: 50, color: rgb(0.06, 0.09, 0.16) });
    page.drawRectangle({ x: 0, y: 736, width: 612, height: 6, color: rgb(0.96, 0.45, 0.14) });
    page.drawText("FORTIFIED FENCE & WELD", {
      x: margin,
      y: 762,
      size: 16,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText("BRANDED WORK ORDER", {
      x: 390,
      y: 764,
      size: 10,
      font: bold,
      color: rgb(0.98, 0.7, 0.45),
    });
    y = 710;
  };

  drawHeader();

  const writeLine = (line: string, options?: { bold?: boolean; size?: number }) => {
    const size = options?.size ?? 10;
    if (y < 48) {
      page = pdf.addPage(pageSize);
      drawHeader();
    }
    page.drawText(line, {
      x: margin,
      y,
      size,
      font: options?.bold ? bold : font,
      color: rgb(0.1, 0.13, 0.18),
    });
    y -= size + 5;
  };

  for (const rawLine of text.split("\n")) {
    const heading = rawLine === rawLine.toUpperCase() && /[A-Z]/.test(rawLine) && rawLine.length < 42;
    for (const line of wrapLine(rawLine, heading ? 70 : 92)) {
      writeLine(line, { bold: heading, size: heading ? 11 : 10 });
    }
  }

  const bytes = await pdf.save();
  await writeFile(pdfPath, bytes, { mode: 0o600 });
  return { pdfPath, textPath, text };
}
