import { z } from "zod";

export const customerTypes = z.enum([
  "commercial",
  "residential",
  "facilities_network",
  "property_manager",
  "government",
  "school",
  "retail",
  "other",
]);

export const customerStatuses = z.enum(["active", "inactive", "prospect"]);

export const customerSchema = z.object({
  company_name: z.string().min(1),
  contact_name: z.string().optional().nullable(),
  contact_email: z.string().optional().nullable(),
  contact_phone: z.string().optional().nullable(),
  billing_email: z.string().optional().nullable(),
  billing_address: z.string().optional().nullable(),
  payment_terms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customer_type: customerTypes,
  status: customerStatuses,
});

export const locationSchema = z.object({
  customer_id: z.string().uuid(),
  location_name: z.string().min(1),
  store_number: z.string().optional().nullable(),
  address_line_1: z.string().min(1),
  address_line_2: z.string().optional().nullable(),
  city: z.string().min(1),
  state: z.string().min(2).max(2),
  zip: z.string().optional().nullable(),
  gate_code: z.string().optional().nullable(),
  access_instructions: z.string().optional().nullable(),
  site_contact_name: z.string().optional().nullable(),
  site_contact_phone: z.string().optional().nullable(),
  site_contact_email: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const subcontractorStatuses = z.enum(["active", "inactive", "probation", "blocked"]);

export const subcontractorSchema = z.object({
  company_name: z.string().min(1),
  owner_name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  service_states: z.string().optional(),
  trades: z.string().optional(),
  service_radius_miles: z.coerce.number().optional().nullable(),
  insurance_expiration: z.string().optional().nullable(),
  w9_received: z.coerce.boolean().optional(),
  subcontractor_agreement_signed: z.coerce.boolean().optional(),
  coi_received: z.coerce.boolean().optional(),
  preferred_vendor: z.coerce.boolean().optional(),
  dedicated_region: z.string().optional().nullable(),
  standard_labor_rate: z.coerce.number().optional().nullable(),
  emergency_labor_rate: z.coerce.number().optional().nullable(),
  trip_charge: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  quality_score: z.coerce.number().optional().nullable(),
  response_score: z.coerce.number().optional().nullable(),
  callback_count: z.coerce.number().int().optional(),
  jobs_completed: z.coerce.number().int().optional(),
  status: subcontractorStatuses,
});

export const workOrderPriorities = z.enum(["low", "normal", "urgent", "emergency"]);

export const workOrderStatuses = z.enum([
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
]);

export const workOrderSources = z.enum([
  "direct",
  "AGM",
  "Home Depot",
  "facilities_network",
  "website",
  "phone",
  "referral",
  "other",
]);

export const workOrderSchema = z.object({
  customer_id: z.string().uuid(),
  location_id: z.string().uuid(),
  subcontractor_id: z.union([z.string().uuid(), z.null()]).optional(),
  title: z.string().min(1),
  scope_summary: z.string().optional().nullable(),
  trade_type: z.string().min(1),
  priority: workOrderPriorities,
  status: workOrderStatuses,
  source: workOrderSources,
  customer_work_order_number: z.string().optional().nullable(),
  purchase_order_number: z.string().optional().nullable(),
  not_to_exceed_amount: z.coerce.number().optional().nullable(),
  requested_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  scheduled_date: z.string().optional().nullable(),
  internal_notes: z.string().optional().nullable(),
  customer_notes: z.string().optional().nullable(),
});

export const quoteStatuses = z.enum(["draft", "sent", "approved", "rejected", "expired"]);

export const invoiceStatuses = z.enum(["draft", "sent", "partially_paid", "paid", "overdue", "void"]);

export const paymentMethods = z.enum(["cash", "check", "ach", "card", "wire", "other"]);

export const maintenancePlanTypes = z.enum(["basic", "pro", "multi_site", "custom"]);
export const maintenanceContractStatuses = z.enum(["draft", "active", "paused", "cancelled", "expired"]);
export const billingFrequencies = z.enum(["monthly", "quarterly", "annually"]);
export const inspectionFrequencies = z.enum(["monthly", "quarterly", "semiannual", "annual"]);
