import type { JobIntakeRecord } from "./job-intake.ts";
import type { InboxMessage } from "./email-inbox.ts";

const SAMPLE_WORK_ORDERS = new Set([
  "MHD-10418",
  "MHD-22104",
  "MHD-33012",
  "TS-21944",
  "TS-18441",
  "WO-45821",
  "ITB-21908",
]);

const SAMPLE_SOURCE_REF =
  /^(mhelpdesk-wo-MHD-|truesource-wo-TS-|demo-gmail-|seed-demo-|demo-thread-|portal-PORTAL-)/i;

const SAMPLE_CUSTOMERS = /Bayou Retail Group|Retail Facilities Group/i;
const SAMPLE_SITES = /Canal Street Store|Kenner Shopping Center|SuperMart #1842/i;
const SAMPLE_SENDERS = /@(fortified\.local|bayou-retail\.example|mhelpdesk\.example|example\.com)$/i;

export function isSampleWorkOrderNumber(value?: string | null) {
  if (!value) return false;
  return SAMPLE_WORK_ORDERS.has(value.trim().toUpperCase());
}

export function isPlaceholderIntakeRecord(record: Pick<JobIntakeRecord, "sourceRef" | "from" | "parsed" | "id">) {
  if (SAMPLE_SOURCE_REF.test(record.sourceRef) || SAMPLE_SOURCE_REF.test(record.id)) return true;
  if (isSampleWorkOrderNumber(record.parsed?.workOrderNumber)) return true;
  if (SAMPLE_CUSTOMERS.test(record.parsed?.customerName ?? "") && SAMPLE_SITES.test(record.parsed?.locationName ?? "")) {
    return true;
  }
  if (record.from && SAMPLE_SENDERS.test(record.from.replace(/.*</, "").replace(/>.*/, "").trim())) {
    return SAMPLE_CUSTOMERS.test(record.parsed?.customerName ?? "") || isSampleWorkOrderNumber(record.parsed?.workOrderNumber);
  }
  return false;
}

export function isPlaceholderInboxMessage(message: Pick<InboxMessage, "id" | "from" | "workOrderNumber">) {
  if (/^demo-gmail-|^demo-thread-/.test(message.id)) return true;
  if (isSampleWorkOrderNumber(message.workOrderNumber)) return true;
  const from = message.from.replace(/.*</, "").replace(/>.*/, "").trim();
  return Boolean(from && SAMPLE_SENDERS.test(from) && isSampleWorkOrderNumber(message.workOrderNumber));
}
