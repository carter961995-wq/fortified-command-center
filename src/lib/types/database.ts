export type WorkOrderStatus =
  | "New"
  | "Needs Site Info"
  | "Waiting on Sub Quote"
  | "Quote Needed"
  | "Quote Sent"
  | "Approved"
  | "Scheduled"
  | "In Progress"
  | "Completed by Sub"
  | "Needs Review"
  | "Ready to Invoice"
  | "Invoiced"
  | "Paid"
  | "Closed"
  | "Callback/Warranty"
  | "Cancelled";

export type Priority = "Low" | "Medium" | "High" | "Urgent";

export type TradeType =
  | "Fence"
  | "Gate"
  | "Welding"
  | "Security Grille"
  | "Bollard"
  | "Facilities Maintenance"
  | "Other";

export type WorkOrderSource =
  | "Phone"
  | "Email"
  | "Customer Portal"
  | "Referral"
  | "Other";

export type JobCostCategory =
  | "Subcontractor"
  | "Materials"
  | "Equipment"
  | "Travel"
  | "Permit"
  | "Other";

export type SubcontractorStatus = "Active" | "Inactive" | "Pending" | "Suspended";

export type MaintenanceFrequency = "Weekly" | "Bi-Weekly" | "Monthly" | "Quarterly" | "Semi-Annual" | "Annual";

export interface Customer {
  id: string;
  company_name: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  payment_terms_days: number;
  tax_exempt: boolean;
  tax_rate: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  customer_id: string;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  gate_code: string | null;
  access_instructions: string | null;
  site_contact_name: string | null;
  site_contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  customer?: Customer;
}

export interface Subcontractor {
  id: string;
  company_name: string;
  owner_name: string;
  phone: string;
  email: string | null;
  service_states: string[];
  service_radius_miles: number | null;
  trades: TradeType[];
  insurance_expiration: string | null;
  w9_received: boolean;
  coi_received: boolean;
  agreement_signed: boolean;
  is_preferred: boolean;
  dedicated_region: string | null;
  labor_rate_per_hour: number | null;
  trip_charge: number | null;
  jobs_completed: number;
  quality_score: number | null;
  response_score: number | null;
  callback_count: number;
  status: SubcontractorStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrder {
  id: string;
  customer_id: string;
  location_id: string;
  subcontractor_id: string | null;
  title: string;
  scope_summary: string | null;
  trade_type: TradeType;
  priority: Priority;
  status: WorkOrderStatus;
  source: WorkOrderSource;
  customer_wo_number: string | null;
  purchase_order_number: string | null;
  nte_amount: number | null;
  requested_date: string | null;
  due_date: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  customer_notes: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  location?: Location;
  subcontractor?: Subcontractor;
  job_costs?: JobCost[];
  quotes?: Quote[];
  invoices?: Invoice[];
}

export interface JobCost {
  id: string;
  work_order_id: string;
  category: JobCostCategory;
  description: string;
  amount: number;
  vendor_name: string | null;
  receipt_url: string | null;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  work_order_id: string;
  quote_number: string;
  description: string | null;
  items: QuoteItem[];
  subtotal: number;
  tax_amount: number;
  total: number;
  valid_until: string | null;
  status: "Draft" | "Sent" | "Accepted" | "Declined" | "Expired";
  sent_date: string | null;
  accepted_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  work_order?: WorkOrder;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Invoice {
  id: string;
  work_order_id: string;
  quote_id: string | null;
  invoice_number: string;
  customer_wo_number: string | null;
  purchase_order_number: string | null;
  description: string | null;
  items: InvoiceItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  invoice_date: string;
  due_date: string;
  payment_terms_days: number;
  status: "Draft" | "Sent" | "Paid" | "Overdue" | "Void";
  sent_date: string | null;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  work_order?: WorkOrder;
  payments?: Payment[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: "Check" | "ACH" | "Wire" | "Credit Card" | "Cash" | "Other";
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface MaintenanceContract {
  id: string;
  customer_id: string;
  location_id: string;
  title: string;
  description: string | null;
  frequency: MaintenanceFrequency;
  monthly_amount: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  next_visit_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  location?: Location;
}

export interface MaintenanceVisit {
  id: string;
  contract_id: string;
  work_order_id: string | null;
  visit_date: string;
  completed: boolean;
  notes: string | null;
  created_at: string;
  contract?: MaintenanceContract;
  work_order?: WorkOrder;
}

export interface ProfitMetrics {
  invoice_total: number;
  total_job_costs: number;
  gross_profit: number;
  gross_margin: number;
}
