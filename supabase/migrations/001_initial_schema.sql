-- Fortified Fence & Weld — Work Order Command Center
-- Initial database schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- CUSTOMERS
-- ============================================================
create table public.customers (
  id uuid primary key default uuid_generate_v4(),
  company_name text not null,
  contact_name text not null,
  email text,
  phone text,
  billing_address_line1 text,
  billing_address_line2 text,
  billing_city text,
  billing_state text,
  billing_zip text,
  payment_terms_days integer not null default 14,
  tax_exempt boolean not null default false,
  tax_rate numeric(5,4) not null default 0,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- LOCATIONS
-- ============================================================
create table public.locations (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  zip text not null,
  gate_code text,
  access_instructions text,
  site_contact_name text,
  site_contact_phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_locations_customer on public.locations(customer_id);

-- ============================================================
-- SUBCONTRACTORS
-- ============================================================
create table public.subcontractors (
  id uuid primary key default uuid_generate_v4(),
  company_name text not null,
  owner_name text not null,
  phone text not null,
  email text,
  service_states text[] not null default '{}',
  service_radius_miles integer,
  trades text[] not null default '{}',
  insurance_expiration date,
  w9_received boolean not null default false,
  coi_received boolean not null default false,
  agreement_signed boolean not null default false,
  is_preferred boolean not null default false,
  dedicated_region text,
  labor_rate_per_hour numeric(10,2),
  trip_charge numeric(10,2),
  jobs_completed integer not null default 0,
  quality_score numeric(3,1),
  response_score numeric(3,1),
  callback_count integer not null default 0,
  status text not null default 'Pending' check (status in ('Active','Inactive','Pending','Suspended')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- WORK ORDERS
-- ============================================================
create table public.work_orders (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.customers(id),
  location_id uuid not null references public.locations(id),
  subcontractor_id uuid references public.subcontractors(id),
  title text not null,
  scope_summary text,
  trade_type text not null default 'Fence' check (trade_type in ('Fence','Gate','Welding','Security Grille','Bollard','Facilities Maintenance','Other')),
  priority text not null default 'Medium' check (priority in ('Low','Medium','High','Urgent')),
  status text not null default 'New' check (status in (
    'New','Needs Site Info','Waiting on Sub Quote','Quote Needed','Quote Sent',
    'Approved','Scheduled','In Progress','Completed by Sub','Needs Review',
    'Ready to Invoice','Invoiced','Paid','Closed','Callback/Warranty','Cancelled'
  )),
  source text not null default 'Phone' check (source in ('Phone','Email','Customer Portal','Referral','Other')),
  customer_wo_number text,
  purchase_order_number text,
  nte_amount numeric(12,2),
  requested_date date,
  due_date date,
  scheduled_date date,
  completed_date date,
  customer_notes text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_work_orders_customer on public.work_orders(customer_id);
create index idx_work_orders_location on public.work_orders(location_id);
create index idx_work_orders_sub on public.work_orders(subcontractor_id);
create index idx_work_orders_status on public.work_orders(status);

-- ============================================================
-- JOB COSTS
-- ============================================================
create table public.job_costs (
  id uuid primary key default uuid_generate_v4(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  category text not null check (category in ('Subcontractor','Materials','Equipment','Travel','Permit','Other')),
  description text not null,
  amount numeric(12,2) not null,
  vendor_name text,
  receipt_url text,
  date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_job_costs_wo on public.job_costs(work_order_id);

-- ============================================================
-- QUOTES
-- ============================================================
create table public.quotes (
  id uuid primary key default uuid_generate_v4(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  quote_number text not null unique,
  description text,
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  valid_until date,
  status text not null default 'Draft' check (status in ('Draft','Sent','Accepted','Declined','Expired')),
  sent_date date,
  accepted_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_quotes_wo on public.quotes(work_order_id);

-- ============================================================
-- QUOTE ITEMS
-- ============================================================
create table public.quote_items (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null,
  amount numeric(12,2) not null
);

create index idx_quote_items_quote on public.quote_items(quote_id);

-- ============================================================
-- INVOICES
-- ============================================================
create table public.invoices (
  id uuid primary key default uuid_generate_v4(),
  work_order_id uuid not null references public.work_orders(id),
  quote_id uuid references public.quotes(id),
  invoice_number text not null unique,
  customer_wo_number text,
  purchase_order_number text,
  description text,
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,4) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  invoice_date date not null default current_date,
  due_date date not null,
  payment_terms_days integer not null default 14,
  status text not null default 'Draft' check (status in ('Draft','Sent','Paid','Overdue','Void')),
  sent_date date,
  paid_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_invoices_wo on public.invoices(work_order_id);

-- ============================================================
-- INVOICE ITEMS
-- ============================================================
create table public.invoice_items (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null,
  amount numeric(12,2) not null
);

create index idx_invoice_items_invoice on public.invoice_items(invoice_id);

-- ============================================================
-- PAYMENTS
-- ============================================================
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_date date not null default current_date,
  payment_method text not null default 'Check' check (payment_method in ('Check','ACH','Wire','Credit Card','Cash','Other')),
  reference_number text,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_payments_invoice on public.payments(invoice_id);

-- ============================================================
-- MAINTENANCE CONTRACTS
-- ============================================================
create table public.maintenance_contracts (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.customers(id),
  location_id uuid not null references public.locations(id),
  title text not null,
  description text,
  frequency text not null default 'Monthly' check (frequency in ('Weekly','Bi-Weekly','Monthly','Quarterly','Semi-Annual','Annual')),
  monthly_amount numeric(12,2) not null,
  start_date date not null,
  end_date date,
  is_active boolean not null default true,
  next_visit_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_maint_contracts_customer on public.maintenance_contracts(customer_id);

-- ============================================================
-- MAINTENANCE VISITS
-- ============================================================
create table public.maintenance_visits (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid not null references public.maintenance_contracts(id) on delete cascade,
  work_order_id uuid references public.work_orders(id),
  visit_date date not null,
  completed boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_maint_visits_contract on public.maintenance_visits(contract_id);

-- ============================================================
-- PHOTOS / DOCUMENTS
-- ============================================================
create table public.documents (
  id uuid primary key default uuid_generate_v4(),
  work_order_id uuid references public.work_orders(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text,
  category text default 'photo' check (category in ('photo','document','receipt','other')),
  notes text,
  uploaded_at timestamptz not null default now()
);

create index idx_documents_wo on public.documents(work_order_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_customers_updated before update on public.customers for each row execute function public.update_updated_at();
create trigger trg_locations_updated before update on public.locations for each row execute function public.update_updated_at();
create trigger trg_subcontractors_updated before update on public.subcontractors for each row execute function public.update_updated_at();
create trigger trg_work_orders_updated before update on public.work_orders for each row execute function public.update_updated_at();
create trigger trg_job_costs_updated before update on public.job_costs for each row execute function public.update_updated_at();
create trigger trg_quotes_updated before update on public.quotes for each row execute function public.update_updated_at();
create trigger trg_invoices_updated before update on public.invoices for each row execute function public.update_updated_at();
create trigger trg_maint_contracts_updated before update on public.maintenance_contracts for each row execute function public.update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.customers enable row level security;
alter table public.locations enable row level security;
alter table public.subcontractors enable row level security;
alter table public.work_orders enable row level security;
alter table public.job_costs enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.maintenance_contracts enable row level security;
alter table public.maintenance_visits enable row level security;
alter table public.documents enable row level security;

-- Authenticated users (internal admin) have full access
create policy "Admin full access" on public.customers for all to authenticated using (true) with check (true);
create policy "Admin full access" on public.locations for all to authenticated using (true) with check (true);
create policy "Admin full access" on public.subcontractors for all to authenticated using (true) with check (true);
create policy "Admin full access" on public.work_orders for all to authenticated using (true) with check (true);
create policy "Admin full access" on public.job_costs for all to authenticated using (true) with check (true);
create policy "Admin full access" on public.quotes for all to authenticated using (true) with check (true);
create policy "Admin full access" on public.quote_items for all to authenticated using (true) with check (true);
create policy "Admin full access" on public.invoices for all to authenticated using (true) with check (true);
create policy "Admin full access" on public.invoice_items for all to authenticated using (true) with check (true);
create policy "Admin full access" on public.payments for all to authenticated using (true) with check (true);
create policy "Admin full access" on public.maintenance_contracts for all to authenticated using (true) with check (true);
create policy "Admin full access" on public.maintenance_visits for all to authenticated using (true) with check (true);
create policy "Admin full access" on public.documents for all to authenticated using (true) with check (true);

-- ============================================================
-- SEQUENCE FOR INVOICE / QUOTE NUMBERS
-- ============================================================
create sequence public.invoice_number_seq start with 1001;
create sequence public.quote_number_seq start with 5001;
