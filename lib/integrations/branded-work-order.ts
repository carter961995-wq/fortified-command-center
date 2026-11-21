import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ContractorCopy, JobIntakeRecord } from "./job-intake.ts";
import { formatMoney, subcontractorDneAmount } from "./subcontractor-dne.ts";

export type BrandedAssignment = {
  fortifiedWorkOrderNumber: string;
  contractorName: string;
  contractorEmail?: string;
  contractorPhone?: string;
  reason: string;
};

export function validateContractorCopy(record: JobIntakeRecord, value: Partial<ContractorCopy> | null | undefined): ContractorCopy {
  if (record.status === "dismissed") throw new Error("Dismissed jobs cannot be dispatched.");
  if (record.dispatchHold || record.dispatch?.status === "withdrawn") throw new Error(record.dispatchHold || "Dispatch withdrawn.");
  if (!record.parsed.workOrderNumber || !record.parsed.state || !record.parsed.tradeType) {
    throw new Error("Verify the work-order number, location and trade before preparing a dispatch.");
  }
  const cap = subcontractorDneAmount(record.parsed.dneAmount, value?.subcontractorDne);
  if (cap == null) throw new Error("Enter a positive subcontractor DNE below the verified customer DNE.");
  const scope = typeof value?.scope === "string" ? value.scope.trim() : "";
  const site = typeof value?.site === "string" ? value.site.trim() : "";
  const schedule = typeof value?.schedule === "string" ? value.schedule.trim() : "";
  if (!scope || scope.length > 2500 || site.length > 500 || schedule.length > 250) {
    throw new Error("Enter the crew-facing scope and keep site/schedule details concise.");
  }
  // Values are explicitly authored for the crew, never filled from upstream free text.
  // Block even explicitly retyped financial/internal markers and URLs as a second guardrail.
  const text = [scope, site, schedule].join("\n");
  if (/(?:\$\s*\d|\b(?:dne|nte|not\s+to\s+exceed|margin|internal\s+notes?)\b|(?:https?:\/\/|www\.))/i.test(text)) {
    throw new Error("Remove pricing, internal notes, and links from the crew-facing fields. Use the subcontractor DNE field.");
  }
  return { subcontractorDne: cap, scope, site: site || undefined, schedule: schedule || undefined, customerCleared: value?.customerCleared === true };
}

export function buildBrandedWorkOrderText(record: JobIntakeRecord, assignment: BrandedAssignment, value?: Partial<ContractorCopy>) {
  const copy = validateContractorCopy(record, value ?? record.dispatch?.contractorCopy);
  return [
    "FORTIFIED FENCE & WELD",
    "WORK ORDER",
    `Fortified WO #: ${assignment.fortifiedWorkOrderNumber}`,
    "",
    "SCOPE",
    copy.scope,
    copy.site ? `Site: ${copy.site}` : null,
    copy.schedule ? `Schedule: ${copy.schedule}` : null,
    `Not to exceed: ${formatMoney(copy.subcontractorDne)}`,
    "",
    "Complete the work within the not-to-exceed amount. Send before and after photos back to Fortified Fence & Weld before leaving the site.",
  ].filter((line) => line !== null).join("\n");
}

export function brandedWorkOrderSubject(assignment: BrandedAssignment) {
  return `Fortified WO ${assignment.fortifiedWorkOrderNumber}`;
}

function wrapLine(text: string, width: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      let rest = word;
      while (rest.length > width) {
        lines.push(rest.slice(0, width));
        rest = rest.slice(width);
      }
      current = rest;
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
  copy: ContractorCopy;
}) {
  await mkdir(input.directory, { recursive: true });
  const text = buildBrandedWorkOrderText(input.record, input.assignment, input.copy);
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
