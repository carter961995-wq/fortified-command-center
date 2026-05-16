export type FieldType = "text" | "textarea" | "email" | "tel" | "number" | "money" | "date" | "checkbox" | "select" | "relation" | "array";

export type ModuleField = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: readonly string[];
  relation?: { table: string; value: string; label: string; orderBy?: string };
  help?: string;
};

export type ListColumn = {
  key: string;
  label: string;
  type?: "text" | "money" | "date" | "status" | "priority" | "percent" | "boolean";
};

export type ModuleDefinition = {
  slug: string;
  table: string;
  label: string;
  singular: string;
  description: string;
  primaryField: string;
  select: string;
  fields: ModuleField[];
  listColumns: ListColumn[];
  statusField?: string;
};

export const workOrderStatuses = [
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
  "Cancelled"
] as const;

export const workOrderLifecycle = [
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
  "Closed"
] as const;

const customerTypes = ["commercial", "residential", "facilities_network", "property_manager", "government", "school", "retail", "other"] as const;
const customerStatuses = ["active", "inactive", "prospect"] as const;
const subcontractorStatuses = ["active", "inactive", "probation", "blocked"] as const;
const priorities = ["low", "normal", "urgent", "emergency"] as const;
const sources = ["direct", "AGM", "Home Depot", "facilities_network", "website", "phone", "referral", "other"] as const;
const quoteStatuses = ["draft", "sent", "approved", "rejected", "expired"] as const;
const invoiceStatuses = ["draft", "sent", "partially_paid", "paid", "overdue", "void"] as const;
const contractStatuses = ["draft", "active", "paused", "cancelled", "expired"] as const;
const planTypes = ["basic", "pro", "multi_site", "custom"] as const;
const billingFrequencies = ["monthly", "quarterly", "annually"] as const;
const inspectionFrequencies = ["monthly", "quarterly", "semiannual", "annual"] as const;

const customerRelation = { table: "customers", value: "id", label: "company_name", orderBy: "company_name" };
const locationRelation = { table: "locations", value: "id", label: "location_name", orderBy: "location_name" };
const subcontractorRelation = { table: "subcontractors", value: "id", label: "company_name", orderBy: "company_name" };
const workOrderRelation = { table: "work_orders", value: "id", label: "work_order_number", orderBy: "work_order_number" };

export const modules: ModuleDefinition[] = [
  {
    slug: "customers",
    table: "customers",
    label: "Customers",
    singular: "Customer",
    description: "Commercial accounts, facilities networks, property managers, and billing contacts.",
    primaryField: "company_name",
    select: "*",
    statusField: "status",
    listColumns: [
      { key: "company_name", label: "Company" },
      { key: "contact_name", label: "Contact" },
      { key: "billing_email", label: "Billing Email" },
      { key: "customer_type", label: "Type" },
      { key: "status", label: "Status", type: "status" }
    ],
    fields: [
      { name: "company_name", label: "Company name", type: "text", required: true },
      { name: "contact_name", label: "Primary contact", type: "text" },
      { name: "contact_email", label: "Contact email", type: "email" },
      { name: "contact_phone", label: "Contact phone", type: "tel" },
      { name: "billing_email", label: "Billing email", type: "email" },
      { name: "billing_address", label: "Billing address", type: "textarea" },
      { name: "payment_terms", label: "Payment terms", type: "text", placeholder: "Net 14" },
      { name: "customer_type", label: "Customer type", type: "select", options: customerTypes, required: true },
      { name: "status", label: "Status", type: "select", options: customerStatuses, required: true },
      { name: "notes", label: "Notes", type: "textarea" }
    ]
  },
  {
    slug: "locations",
    table: "locations",
    label: "Locations",
    singular: "Location",
    description: "Job sites, store numbers, access instructions, and site contacts.",
    primaryField: "location_name",
    select: "*, customers(company_name)",
    listColumns: [
      { key: "location_name", label: "Location" },
      { key: "customers.company_name", label: "Customer" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "site_contact_phone", label: "Site Phone" }
    ],
    fields: [
      { name: "customer_id", label: "Customer", type: "relation", relation: customerRelation, required: true },
      { name: "location_name", label: "Location name", type: "text", required: true },
      { name: "store_number", label: "Store number", type: "text" },
      { name: "address_line_1", label: "Address line 1", type: "text", required: true },
      { name: "address_line_2", label: "Address line 2", type: "text" },
      { name: "city", label: "City", type: "text", required: true },
      { name: "state", label: "State", type: "text", required: true },
      { name: "zip", label: "ZIP", type: "text" },
      { name: "gate_code", label: "Gate code", type: "text" },
      { name: "access_instructions", label: "Access instructions", type: "textarea" },
      { name: "site_contact_name", label: "Site contact", type: "text" },
      { name: "site_contact_phone", label: "Site phone", type: "tel" },
      { name: "site_contact_email", label: "Site email", type: "email" },
      { name: "notes", label: "Notes", type: "textarea" }
    ]
  },
  {
    slug: "subcontractors",
    table: "subcontractors",
    label: "Subcontractors",
    singular: "Subcontractor",
    description: "Vendor coverage, compliance, rates, quality, and dispatch readiness.",
    primaryField: "company_name",
    select: "*",
    statusField: "status",
    listColumns: [
      { key: "company_name", label: "Company" },
      { key: "owner_name", label: "Owner" },
      { key: "service_states", label: "States" },
      { key: "trades", label: "Trades" },
      { key: "preferred_vendor", label: "Preferred", type: "boolean" },
      { key: "status", label: "Status", type: "status" }
    ],
    fields: [
      { name: "company_name", label: "Company name", type: "text", required: true },
      { name: "owner_name", label: "Owner name", type: "text" },
      { name: "phone", label: "Phone", type: "tel" },
      { name: "email", label: "Email", type: "email" },
      { name: "address", label: "Address", type: "text" },
      { name: "city", label: "City", type: "text" },
      { name: "state", label: "State", type: "text" },
      { name: "zip", label: "ZIP", type: "text" },
      { name: "service_states", label: "Service states", type: "array", help: "Comma-separated state abbreviations." },
      { name: "service_radius_miles", label: "Service radius miles", type: "number" },
      { name: "trades", label: "Trades", type: "array", help: "Fence, gate, welding, security grille, bollards, facilities." },
      { name: "insurance_expiration", label: "Insurance expiration", type: "date" },
      { name: "w9_received", label: "W-9 received", type: "checkbox" },
      { name: "coi_received", label: "COI received", type: "checkbox" },
      { name: "subcontractor_agreement_signed", label: "Agreement signed", type: "checkbox" },
      { name: "preferred_vendor", label: "Preferred vendor", type: "checkbox" },
      { name: "dedicated_region", label: "Dedicated region", type: "text" },
      { name: "standard_labor_rate", label: "Standard labor rate", type: "money" },
      { name: "emergency_labor_rate", label: "Emergency labor rate", type: "money" },
      { name: "trip_charge", label: "Trip charge", type: "money" },
      { name: "quality_score", label: "Quality score", type: "number" },
      { name: "response_score", label: "Response score", type: "number" },
      { name: "callback_count", label: "Callback count", type: "number" },
      { name: "jobs_completed", label: "Jobs completed", type: "number" },
      { name: "status", label: "Status", type: "select", options: subcontractorStatuses, required: true },
      { name: "notes", label: "Notes", type: "textarea" }
    ]
  },
  {
    slug: "work-orders",
    table: "work_orders",
    label: "Work Orders",
    singular: "Work Order",
    description: "Dispatch pipeline from intake through quote, completion, invoice, payment, and closeout.",
    primaryField: "title",
    select: "*, customers(company_name), locations(location_name, city, state), subcontractors(company_name)",
    statusField: "status",
    listColumns: [
      { key: "work_order_number", label: "WO #" },
      { key: "title", label: "Title" },
      { key: "customers.company_name", label: "Customer" },
      { key: "locations.state", label: "State" },
      { key: "priority", label: "Priority", type: "priority" },
      { key: "status", label: "Status", type: "status" },
      { key: "scheduled_date", label: "Scheduled", type: "date" }
    ],
    fields: [
      { name: "work_order_number", label: "Work order number", type: "text", placeholder: "Auto if blank" },
      { name: "customer_id", label: "Customer", type: "relation", relation: customerRelation, required: true },
      { name: "location_id", label: "Location", type: "relation", relation: locationRelation, required: true },
      { name: "subcontractor_id", label: "Assigned subcontractor", type: "relation", relation: subcontractorRelation },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "scope_summary", label: "Scope summary", type: "textarea" },
      { name: "trade_type", label: "Trade type", type: "text", placeholder: "Fence, gate, welding, security grille" },
      { name: "priority", label: "Priority", type: "select", options: priorities, required: true },
      { name: "status", label: "Status", type: "select", options: workOrderStatuses, required: true },
      { name: "source", label: "Source", type: "select", options: sources, required: true },
      { name: "customer_work_order_number", label: "Customer WO #", type: "text" },
      { name: "purchase_order_number", label: "Purchase order #", type: "text" },
      { name: "not_to_exceed_amount", label: "Not-to-exceed amount", type: "money" },
      { name: "requested_date", label: "Requested date", type: "date" },
      { name: "due_date", label: "Due date", type: "date" },
      { name: "scheduled_date", label: "Scheduled date", type: "date" },
      { name: "completed_date", label: "Completed date", type: "date" },
      { name: "customer_notes", label: "Customer notes", type: "textarea" },
      { name: "internal_notes", label: "Internal notes", type: "textarea" }
    ]
  },
  {
    slug: "quotes",
    table: "quotes",
    label: "Quotes",
    singular: "Quote",
    description: "Customer quote records linked to work orders before approval and invoicing.",
    primaryField: "quote_number",
    select: "*, customers(company_name), locations(location_name), work_orders(work_order_number, title)",
    statusField: "status",
    listColumns: [
      { key: "quote_number", label: "Quote #" },
      { key: "work_orders.work_order_number", label: "WO #" },
      { key: "customers.company_name", label: "Customer" },
      { key: "status", label: "Status", type: "status" },
      { key: "total_amount", label: "Total", type: "money" },
      { key: "valid_until", label: "Valid Until", type: "date" }
    ],
    fields: [
      { name: "quote_number", label: "Quote number", type: "text", placeholder: "Auto if blank" },
      { name: "work_order_id", label: "Work order", type: "relation", relation: workOrderRelation, required: true },
      { name: "customer_id", label: "Customer", type: "relation", relation: customerRelation, required: true },
      { name: "location_id", label: "Location", type: "relation", relation: locationRelation, required: true },
      { name: "status", label: "Status", type: "select", options: quoteStatuses, required: true },
      { name: "subtotal", label: "Subtotal", type: "money" },
      { name: "tax_amount", label: "Tax", type: "money" },
      { name: "total_amount", label: "Total", type: "money" },
      { name: "customer_message", label: "Customer message", type: "textarea" },
      { name: "internal_notes", label: "Internal notes", type: "textarea" },
      { name: "valid_until", label: "Valid until", type: "date" },
      { name: "sent_at", label: "Sent at", type: "date" },
      { name: "approved_at", label: "Approved at", type: "date" }
    ]
  },
  {
    slug: "invoices",
    table: "invoices",
    label: "Invoices",
    singular: "Invoice",
    description: "Customer invoices, payment tracking, balances, due dates, and PDF output.",
    primaryField: "invoice_number",
    select: "*, customers(company_name, payment_terms), locations(location_name), work_orders(work_order_number, title, customer_work_order_number, purchase_order_number)",
    statusField: "status",
    listColumns: [
      { key: "invoice_number", label: "Invoice #" },
      { key: "customers.company_name", label: "Customer" },
      { key: "status", label: "Status", type: "status" },
      { key: "total_amount", label: "Total", type: "money" },
      { key: "amount_paid", label: "Paid", type: "money" },
      { key: "balance_due", label: "Balance", type: "money" },
      { key: "due_date", label: "Due", type: "date" }
    ],
    fields: [
      { name: "invoice_number", label: "Invoice number", type: "text", placeholder: "Auto if blank" },
      { name: "work_order_id", label: "Work order", type: "relation", relation: workOrderRelation, required: true },
      { name: "customer_id", label: "Customer", type: "relation", relation: customerRelation, required: true },
      { name: "location_id", label: "Location", type: "relation", relation: locationRelation, required: true },
      { name: "status", label: "Status", type: "select", options: invoiceStatuses, required: true },
      { name: "subtotal", label: "Subtotal", type: "money" },
      { name: "tax_amount", label: "Tax", type: "money" },
      { name: "total_amount", label: "Total", type: "money" },
      { name: "amount_paid", label: "Amount paid", type: "money" },
      { name: "balance_due", label: "Balance due", type: "money" },
      { name: "invoice_date", label: "Invoice date", type: "date" },
      { name: "due_date", label: "Due date", type: "date" },
      { name: "sent_at", label: "Sent at", type: "date" },
      { name: "paid_at", label: "Paid at", type: "date" },
      { name: "payment_terms", label: "Payment terms", type: "text", placeholder: "Net 14" },
      { name: "pdf_url", label: "PDF URL", type: "text" },
      { name: "notes", label: "Notes", type: "textarea" }
    ]
  },
  {
    slug: "maintenance-contracts",
    table: "maintenance_contracts",
    label: "Maintenance Contracts",
    singular: "Maintenance Contract",
    description: "Recurring inspection and maintenance plans for customers and sites.",
    primaryField: "contract_name",
    select: "*, customers(company_name), locations(location_name)",
    statusField: "status",
    listColumns: [
      { key: "contract_name", label: "Contract" },
      { key: "customers.company_name", label: "Customer" },
      { key: "plan_type", label: "Plan" },
      { key: "status", label: "Status", type: "status" },
      { key: "recurring_amount", label: "Recurring", type: "money" },
      { key: "inspection_frequency", label: "Inspection" }
    ],
    fields: [
      { name: "customer_id", label: "Customer", type: "relation", relation: customerRelation, required: true },
      { name: "location_id", label: "Location", type: "relation", relation: locationRelation },
      { name: "contract_name", label: "Contract name", type: "text", required: true },
      { name: "plan_type", label: "Plan type", type: "select", options: planTypes, required: true },
      { name: "status", label: "Status", type: "select", options: contractStatuses, required: true },
      { name: "start_date", label: "Start date", type: "date" },
      { name: "end_date", label: "End date", type: "date" },
      { name: "billing_frequency", label: "Billing frequency", type: "select", options: billingFrequencies, required: true },
      { name: "recurring_amount", label: "Recurring amount", type: "money" },
      { name: "inspection_frequency", label: "Inspection frequency", type: "select", options: inspectionFrequencies, required: true },
      { name: "included_services", label: "Included services", type: "textarea" },
      { name: "excluded_services", label: "Excluded services", type: "textarea" },
      { name: "priority_dispatch", label: "Priority dispatch", type: "checkbox" },
      { name: "discount_percent", label: "Discount percent", type: "number" },
      { name: "notes", label: "Notes", type: "textarea" }
    ]
  }
];

export const moduleMap = Object.fromEntries(modules.map((module) => [module.slug, module])) as Record<string, ModuleDefinition>;

export const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  ...modules.map((module) => ({ href: `/${module.slug}`, label: module.label })),
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" }
];
