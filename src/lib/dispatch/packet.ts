export type DispatchPacketInput = {
  workOrderNumber: string;
  title: string;
  status: string;
  priority: string;
  tradeType: string;
  scope?: string | null;
  customerName?: string | null;
  customerWorkOrderNumber?: string | null;
  purchaseOrderNumber?: string | null;
  nte?: number | null;
  locationName?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  accessInstructions?: string | null;
  scheduledDate?: string | null;
  dueDate?: string | null;
  requestedDate?: string | null;
  siteContactName?: string | null;
  siteContactPhone?: string | null;
  subcontractorName?: string | null;
  customerNotes?: string | null;
  internalNotes?: string | null;
};

export function money(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
}

export function buildFortifiedDispatchPacket(input: DispatchPacketInput) {
  const site = [input.address, [input.city, input.state, input.zip].filter(Boolean).join(", ")].filter(Boolean).join("\n");
  return [
    "FORTIFIED FENCE & WELD",
    "Subcontractor Work Order",
    "========================================",
    "",
    `Fortified WO #: ${input.workOrderNumber}`,
    `Customer WO #: ${input.customerWorkOrderNumber || "—"}`,
    `PO #: ${input.purchaseOrderNumber || "—"}`,
    `Status: ${input.status}`,
    `Priority: ${input.priority}`,
    `Trade: ${input.tradeType}`,
    "",
    "CUSTOMER / SITE",
    "---------------",
    `Account: ${input.customerName || "—"}`,
    `Location: ${input.locationName || "—"}`,
    `Address:`,
    site || "—",
    `Access: ${input.accessInstructions || "—"}`,
    `Site contact: ${[input.siteContactName, input.siteContactPhone].filter(Boolean).join(" · ") || "—"}`,
    "",
    "SCHEDULE",
    "--------",
    `Requested: ${input.requestedDate || "—"}`,
    `Due: ${input.dueDate || "—"}`,
    `Scheduled: ${input.scheduledDate || "—"}`,
    `NTE / DNE: ${money(input.nte)}`,
    "",
    "SCOPE OF WORK",
    "-------------",
    input.title,
    "",
    input.scope || "See customer notes.",
    "",
    "CUSTOMER / NATIONAL ACCOUNT NOTES",
    "---------------------------------",
    input.customerNotes || "—",
    "",
    "ASSIGNED SUBCONTRACTOR",
    "----------------------",
    input.subcontractorName || "Unassigned",
    "",
    "COMPLETION REQUIREMENTS",
    "-----------------------",
    "1. Check in with site contact before starting.",
    "2. Take before / during / after photos.",
    "3. Do not exceed NTE without written Fortified approval.",
    "4. Return unused materials and haul-off debris unless noted.",
    "5. Send completion photos and invoice backup to Fortified before leaving site.",
    "",
    "INTERNAL (do not send to customer)",
    "----------------------------------",
    input.internalNotes || "—",
    "",
    "Questions: Fortified Fence & Weld · (318) 446-2134",
  ].join("\n");
}

export function buildSubcontractorEmail(input: DispatchPacketInput) {
  const subject = [
    input.workOrderNumber,
    input.customerWorkOrderNumber ? `Cust WO ${input.customerWorkOrderNumber}` : null,
    input.title,
  ]
    .filter(Boolean)
    .join(" · ");

  const body = [
    `Hello ${input.subcontractorName || "team"},`,
    "",
    "Please see the Fortified work order below. Confirm schedule and any NTE questions before mobilizing.",
    "",
    buildFortifiedDispatchPacket(input),
    "",
    "Thank you,",
    "Fortified Fence & Weld Dispatch",
  ].join("\n");

  return { subject, body };
}
