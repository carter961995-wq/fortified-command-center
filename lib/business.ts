import { workOrderLifecycle } from "./schema.ts";

export type PlainRow = Record<string, unknown>;

export function money(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(amount) ? amount : 0);
}

export function percent(value: unknown) {
  const amount = Number(value ?? 0);
  return `${Number.isFinite(amount) ? amount.toFixed(1) : "0.0"}%`;
}

export const BUSINESS_TIME_ZONE = "America/Chicago";

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDate(value: string) {
  const match = CALENDAR_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

export function businessToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function calendarDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (isCalendarDate(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

export function formatDate(value: unknown) {
  if (!value || typeof value !== "string") return "-";
  if (isCalendarDate(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(date);
}

export function startOfBusinessWeek(today = businessToday()) {
  const [year, month, day] = today.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  utc.setUTCDate(utc.getUTCDate() + mondayOffset);
  return utc.toISOString().slice(0, 10);
}

export function endOfBusinessWeek(today = businessToday()) {
  const start = startOfBusinessWeek(today);
  const [year, month, day] = start.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + 6));
  return utc.toISOString().slice(0, 10);
}

export type ScheduleBucket = "today" | "week" | "upcoming" | "unscheduled" | "earlier";

export function scheduleBucket(scheduled: unknown, today = businessToday()): ScheduleBucket {
  const date = typeof scheduled === "string" && scheduled ? calendarDate(scheduled) : null;
  if (!date) return "unscheduled";
  if (date === today) return "today";
  const weekStart = startOfBusinessWeek(today);
  const weekEnd = endOfBusinessWeek(today);
  if (date >= weekStart && date <= weekEnd) return "week";
  if (date > weekEnd) return "upcoming";
  return "earlier";
}

export function displayValue(row: PlainRow, path: string) {
  const value = path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) return (acc as PlainRow)[part];
    return undefined;
  }, row);
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

export function statusTone(status: unknown) {
  const normalized = String(status ?? "").toLowerCase();
  if (["paid", "closed", "approved", "active", "completed"].some((word) => normalized.includes(word))) return "green";
  if (["urgent", "emergency", "overdue", "blocked", "cancelled", "callback", "rejected"].some((word) => normalized.includes(word))) return "red";
  if (["ready", "sent", "scheduled", "progress", "partially", "probation"].some((word) => normalized.includes(word))) return "amber";
  return "slate";
}

export function nextWorkOrderStatus(status: unknown) {
  const current = String(status ?? "New");
  const index = workOrderLifecycle.findIndex((item) => item === current);
  if (index < 0 || index >= workOrderLifecycle.length - 1) return null;
  return workOrderLifecycle[index + 1];
}

export function statusTimestampUpdates(newStatus: string, existing: PlainRow = {}) {
  const now = new Date().toISOString();
  const updates: PlainRow = {};
  if (newStatus === "Approved" && !existing.customer_approved_at) updates.customer_approved_at = now;
  if (newStatus === "Completed by Sub" && !existing.completed_date) updates.completed_date = now.slice(0, 10);
  if (newStatus === "Invoiced" && !existing.invoice_sent_at) updates.invoice_sent_at = now;
  if (newStatus === "Paid" && !existing.paid_at) updates.paid_at = now;
  return updates;
}

export function calculateProfit(invoiceTotal: unknown, costs: unknown) {
  const revenue = Number(invoiceTotal ?? 0);
  const totalCosts = Number(costs ?? 0);
  const grossProfit = revenue - totalCosts;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  return { revenue, totalCosts, grossProfit, grossMargin };
}

export function invoiceStatusFromBalance(total: number, amountPaid: number, dueDate?: string | null, now = new Date()) {
  const balanceDue = Math.max(Math.round((total - amountPaid) * 100) / 100, 0);
  if (balanceDue <= 0 && total > 0) return "paid";
  if (amountPaid > 0 && balanceDue > 0) {
    const due = dueDate ? calendarDate(dueDate) : null;
    if (due && due < businessToday(now)) return "overdue";
    return "partially_paid";
  }
  const due = dueDate ? calendarDate(dueDate) : null;
  if (due && due < businessToday(now) && balanceDue > 0) return "overdue";
  return "sent";
}
