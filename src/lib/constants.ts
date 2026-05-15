import type { WorkOrderStatus, Priority, TradeType, JobCostCategory, SubcontractorStatus, MaintenanceFrequency } from "./types/database";

export const COMPANY = {
  name: "Fortified Fence & Weld",
  phone: "(318) 446-2134",
  tagline: "Commercial Fence, Gate, Welding & Security Solutions",
  defaultPaymentTermsDays: 14,
} as const;

export const WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  "New",
  "Needs Site Info",
  "Waiting on Sub Quote",
  "Quote Needed",
  "Quote Sent",
  "Approved",
  "Scheduled",
  "In Progress",
  "Completed by Sub",
  "Needs Review",
  "Ready to Invoice",
  "Invoiced",
  "Paid",
  "Closed",
  "Callback/Warranty",
  "Cancelled",
];

export const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Urgent"];

export const TRADE_TYPES: TradeType[] = [
  "Fence",
  "Gate",
  "Welding",
  "Security Grille",
  "Bollard",
  "Facilities Maintenance",
  "Other",
];

export const JOB_COST_CATEGORIES: JobCostCategory[] = [
  "Subcontractor",
  "Materials",
  "Equipment",
  "Travel",
  "Permit",
  "Other",
];

export const SUBCONTRACTOR_STATUSES: SubcontractorStatus[] = [
  "Active",
  "Inactive",
  "Pending",
  "Suspended",
];

export const MAINTENANCE_FREQUENCIES: MaintenanceFrequency[] = [
  "Weekly",
  "Bi-Weekly",
  "Monthly",
  "Quarterly",
  "Semi-Annual",
  "Annual",
];

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
] as const;

export function getStatusColor(status: WorkOrderStatus): string {
  const colors: Record<WorkOrderStatus, string> = {
    "New": "bg-blue-100 text-blue-800",
    "Needs Site Info": "bg-yellow-100 text-yellow-800",
    "Waiting on Sub Quote": "bg-orange-100 text-orange-800",
    "Quote Needed": "bg-amber-100 text-amber-800",
    "Quote Sent": "bg-indigo-100 text-indigo-800",
    "Approved": "bg-emerald-100 text-emerald-800",
    "Scheduled": "bg-cyan-100 text-cyan-800",
    "In Progress": "bg-purple-100 text-purple-800",
    "Completed by Sub": "bg-teal-100 text-teal-800",
    "Needs Review": "bg-rose-100 text-rose-800",
    "Ready to Invoice": "bg-lime-100 text-lime-800",
    "Invoiced": "bg-sky-100 text-sky-800",
    "Paid": "bg-green-100 text-green-800",
    "Closed": "bg-gray-100 text-gray-800",
    "Callback/Warranty": "bg-red-100 text-red-800",
    "Cancelled": "bg-stone-100 text-stone-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export function getPriorityColor(priority: Priority): string {
  const colors: Record<Priority, string> = {
    Low: "bg-slate-100 text-slate-700",
    Medium: "bg-blue-100 text-blue-700",
    High: "bg-orange-100 text-orange-700",
    Urgent: "bg-red-100 text-red-700",
  };
  return colors[priority] || "bg-gray-100 text-gray-700";
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function calculateProfitMetrics(invoiceTotal: number, totalJobCosts: number) {
  const grossProfit = invoiceTotal - totalJobCosts;
  const grossMargin = invoiceTotal > 0 ? (grossProfit / invoiceTotal) * 100 : 0;
  return { invoice_total: invoiceTotal, total_job_costs: totalJobCosts, gross_profit: grossProfit, gross_margin: grossMargin };
}
