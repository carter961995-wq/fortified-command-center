import { workOrderLifecycle } from "@/lib/schema";

export type PlainRow = Record<string, unknown>;

export function money(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(amount) ? amount : 0);
}

export function percent(value: unknown) {
  const amount = Number(value ?? 0);
  return `${Number.isFinite(amount) ? amount.toFixed(1) : "0.0"}%`;
}

export function formatDate(value: unknown) {
  if (!value || typeof value !== "string") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
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

export function invoiceStatusFromBalance(total: number, amountPaid: number, dueDate?: string | null) {
  const balanceDue = Math.max(total - amountPaid, 0);
  if (balanceDue <= 0 && total > 0) return "paid";
  if (amountPaid > 0 && balanceDue > 0) return "partially_paid";
  if (dueDate && new Date(dueDate) < new Date() && balanceDue > 0) return "overdue";
  return "sent";
}
