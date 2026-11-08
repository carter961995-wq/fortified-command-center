export const WORK_ORDER_VIEW_STATUSES = {
  "pending-estimates": ["Needs Site Info", "Waiting on Sub Quote", "Quote Needed", "Quote Sent"],
  "awaiting-input": ["Needs Site Info", "Waiting on Sub Quote", "Quote Sent", "Needs Review"],
  "subcontractor-dispatch": ["Approved", "Scheduled", "In Progress", "Completed by Sub", "Needs Review"],
  "invoice-ready": ["Ready to Invoice"],
} as const;

export type WorkOrderView = keyof typeof WORK_ORDER_VIEW_STATUSES | "confirmed-deadlines";

export const OPEN_INVOICE_STATUSES = ["sent", "partially_paid", "overdue"] as const;
export const PENDING_QUOTE_STATUSES = ["draft", "sent"] as const;

const WORK_ORDER_NEXT_ACTION: Record<string, string> = {
  New: "Review intake and confirm scope requirements",
  "Needs Site Info": "Collect photos, measurements, access details, or site information",
  "Waiting on Sub Quote": "Obtain subcontractor pricing before committing cost",
  "Quote Needed": "Build and internally review the estimate",
  "Quote Sent": "Await customer approval before scheduling or dispatch",
  Approved: "Confirm crew, materials, and approved financial limits",
  Scheduled: "Confirm crew readiness, access, materials, and check-in requirements",
  "In Progress": "Monitor field progress and document approved changes",
  "Completed by Sub": "Collect completion photos, checkout proof, and final cost details",
  "Needs Review": "Review completion package and any extra-charge request",
  "Ready to Invoice": "Create invoice for the approved completed scope",
  Invoiced: "Track remittance and payment status",
  Paid: "Verify closeout documents and close the work order",
  Closed: "No action required",
  "Callback/Warranty": "Resolve callback and document corrective work",
  Cancelled: "No action required",
};

export function workOrderNextAction(status: string | null | undefined) {
  if (!status) return "Review work order";
  return WORK_ORDER_NEXT_ACTION[status] ?? "Review work order";
}

export function quoteNextAction(status: string | null | undefined) {
  switch (status) {
    case "draft":
      return "Finalize pricing and internal review before customer send";
    case "sent":
      return "Await customer approval; do not dispatch from an unapproved estimate";
    case "approved":
      return "Schedule approved scope and preserve approval documentation";
    case "rejected":
      return "Revise only if the customer requests a new proposal";
    case "expired":
      return "Reprice and issue a new approval-ready estimate if still active";
    default:
      return "Review estimate status";
  }
}
