-- Fortified Work Order Command Center initial MVP schema
-- Apply in Supabase SQL editor or with: supabase db push

create extension if not exists pgcrypto;

create sequence if not exists public.work_order_number_seq start 1001;
create sequence if not exists public.quote_number_seq start 1001;
create sequence if not exists public.invoice_number_seq start 1001;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users_profile (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  phone text,
  role text not null default 'dispatcher' check (role in ('owner','admin','dispatcher','subcontractor','customer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  billing_email text,
  billing_address text,
  payment_terms text not null default 'Net 14',
  notes text,
  customer_type text not null default 'commercial' check (customer_type in ('commercial','residential','facilities_network','property_manager','government','school','retail','other')),
  status text not null default 'active' check (status in ('active','inactive','prospect')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  location_name text not null,
  store_number text,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  state text not null,
  zip text,
  gate_code text,
  access_instructions text,
  site_contact_name text,
  site_contact_phone text,
  site_contact_email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  owner_name text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  zip text,
  service_states text[] not null default '{}',
  service_radius_miles integer,
  trades text[] not null default '{}',
  insurance_expiration date,
  w9_received boolean not null default false,
  subcontractor_agreement_signed boolean not null default false,
  coi_received boolean not null default false,
  preferred_vendor boolean not null default false,
  dedicated_region text,
  standard_labor_rate numeric(12,2) not null default 0,
  emergency_labor_rate numeric(12,2) not null default 0,
  trip_charge numeric(12,2) not null default 0,
  notes text,
  quality_score numeric(4,2) not null default 0,
  response_score numeric(4,2) not null default 0,
  callback_count integer not null default 0,
  jobs_completed integer not null default 0,
  status text not null default 'active' check (status in ('active','inactive','probation','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  work_order_number text unique not null default ('WO-' || to_char(nextval('public.work_order_number_seq'), 'FM000000')),
  customer_id uuid not null references public.customers(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  subcontractor_id uuid references public.subcontractors(id) on delete set null,
  title text not null,
  scope_summary text,
  trade_type text,
  priority text not null default 'normal' check (priority in ('low','normal','urgent','emergency')),
  status text not null default 'New' check (status in ('New','Needs Site Info','Waiting on Sub Quote','Quote Needed','Quote Sent','Approved','Scheduled','In Progress','Completed by Sub','Needs Review','Ready to Invoice','Invoiced','Paid','Closed','Callback/Warranty','Cancelled')),
  source text not null default 'direct' check (source in ('direct','AGM','Home Depot','facilities_network','website','phone','referral','other')),
  customer_work_order_number text,
  purchase_order_number text,
  not_to_exceed_amount numeric(12,2),
  requested_date date,
  due_date date,
  scheduled_date date,
  completed_date date,
  customer_approved_at timestamptz,
  invoice_sent_at timestamptz,
  paid_at timestamptz,
  internal_notes text,
  customer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_order_photos (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  photo_url text not null,
  photo_type text not null default 'other' check (photo_type in ('before','during','after','receipt','damage','other')),
  caption text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.work_order_documents (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  document_url text not null,
  document_type text not null default 'other' check (document_type in ('quote','invoice','receipt','completion_form','contract','other')),
  filename text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text unique not null default ('Q-' || to_char(nextval('public.quote_number_seq'), 'FM000000')),
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','sent','approved','rejected','expired')),
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  customer_message text,
  internal_notes text,
  valid_until date,
  sent_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete restrict,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null default ('INV-' || to_char(nextval('public.invoice_number_seq'), 'FM000000')),
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','sent','partially_paid','paid','overdue','void')),
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  invoice_date date not null default current_date,
  due_date date not null default (current_date + interval '14 days'),
  sent_at timestamptz,
  paid_at timestamptz,
  payment_terms text not null default 'Net 14',
  pdf_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null default 'other' check (payment_method in ('cash','check','ach','card','wire','other')),
  reference_number text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.job_costs (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  subcontractor_id uuid references public.subcontractors(id) on delete set null,
  cost_type text not null default 'other' check (cost_type in ('subcontractor','materials','equipment','travel','permit','other')),
  description text not null,
  amount numeric(12,2) not null default 0,
  receipt_url text,
  paid boolean not null default false,
  paid_at date,
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_contracts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  location_id uuid references public.locations(id) on delete restrict,
  contract_name text not null,
  plan_type text not null default 'basic' check (plan_type in ('basic','pro','multi_site','custom')),
  status text not null default 'draft' check (status in ('draft','active','paused','cancelled','expired')),
  start_date date,
  end_date date,
  billing_frequency text not null default 'monthly' check (billing_frequency in ('monthly','quarterly','annually')),
  recurring_amount numeric(12,2) not null default 0,
  inspection_frequency text not null default 'quarterly' check (inspection_frequency in ('monthly','quarterly','semiannual','annual')),
  included_services text,
  excluded_services text,
  priority_dispatch boolean not null default false,
  discount_percent numeric(5,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_visits (
  id uuid primary key default gen_random_uuid(),
  maintenance_contract_id uuid not null references public.maintenance_contracts(id) on delete restrict,
  work_order_id uuid references public.work_orders(id) on delete set null,
  scheduled_date date,
  completed_date date,
  status text not null default 'scheduled' check (status in ('scheduled','completed','missed','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_profile_auth_user_id on public.users_profile(auth_user_id);
create index if not exists idx_customers_status on public.customers(status);
create index if not exists idx_locations_customer_id on public.locations(customer_id);
create index if not exists idx_subcontractors_status on public.subcontractors(status);
create index if not exists idx_subcontractors_service_states on public.subcontractors using gin(service_states);
create index if not exists idx_subcontractors_trades on public.subcontractors using gin(trades);
create index if not exists idx_work_orders_customer_id on public.work_orders(customer_id);
create index if not exists idx_work_orders_location_id on public.work_orders(location_id);
create index if not exists idx_work_orders_subcontractor_id on public.work_orders(subcontractor_id);
create index if not exists idx_work_orders_status on public.work_orders(status);
create index if not exists idx_work_orders_due_date on public.work_orders(due_date);
create index if not exists idx_work_orders_scheduled_date on public.work_orders(scheduled_date);
create index if not exists idx_quotes_work_order_id on public.quotes(work_order_id);
create index if not exists idx_quotes_customer_id on public.quotes(customer_id);
create index if not exists idx_invoices_work_order_id on public.invoices(work_order_id);
create index if not exists idx_invoices_customer_id on public.invoices(customer_id);
create index if not exists idx_invoices_status_due_date on public.invoices(status, due_date);
create index if not exists idx_payments_invoice_id on public.payments(invoice_id);
create index if not exists idx_job_costs_work_order_id on public.job_costs(work_order_id);
create index if not exists idx_maintenance_contracts_customer_id on public.maintenance_contracts(customer_id);
create index if not exists idx_maintenance_visits_contract_id on public.maintenance_visits(maintenance_contract_id);

create or replace function public.set_work_order_status_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'Approved' and new.customer_approved_at is null then
    new.customer_approved_at = now();
  end if;
  if new.status = 'Completed by Sub' and new.completed_date is null then
    new.completed_date = current_date;
  end if;
  if new.status = 'Invoiced' and new.invoice_sent_at is null then
    new.invoice_sent_at = now();
  end if;
  if new.status = 'Paid' and new.paid_at is null then
    new.paid_at = now();
  end if;
  return new;
end;
$$;

create or replace function public.set_line_item_total()
returns trigger
language plpgsql
as $$
begin
  new.total = coalesce(new.quantity, 0) * coalesce(new.unit_price, 0);
  return new;
end;
$$;

create or replace function public.recalculate_quote_totals(target_quote_id uuid)
returns void
language plpgsql
as $$
declare
  subtotal_value numeric(12,2);
  tax_value numeric(12,2);
begin
  select coalesce(sum(total), 0) into subtotal_value from public.quote_line_items where quote_id = target_quote_id;
  select coalesce(tax_amount, 0) into tax_value from public.quotes where id = target_quote_id;
  update public.quotes set subtotal = subtotal_value, total_amount = subtotal_value + tax_value, updated_at = now() where id = target_quote_id;
end;
$$;

create or replace function public.recalculate_invoice_totals(target_invoice_id uuid)
returns void
language plpgsql
as $$
declare
  subtotal_value numeric(12,2);
  tax_value numeric(12,2);
  paid_value numeric(12,2);
  total_value numeric(12,2);
  due_value date;
begin
  select coalesce(sum(total), 0) into subtotal_value from public.invoice_line_items where invoice_id = target_invoice_id;
  select coalesce(tax_amount, 0), due_date into tax_value, due_value from public.invoices where id = target_invoice_id;
  select coalesce(sum(amount), 0) into paid_value from public.payments where invoice_id = target_invoice_id;
  total_value := subtotal_value + tax_value;

  update public.invoices
  set subtotal = subtotal_value,
      total_amount = total_value,
      amount_paid = paid_value,
      balance_due = greatest(total_value - paid_value, 0),
      status = case
        when total_value > 0 and greatest(total_value - paid_value, 0) = 0 then 'paid'
        when paid_value > 0 and greatest(total_value - paid_value, 0) > 0 then 'partially_paid'
        when due_value < current_date and greatest(total_value - paid_value, 0) > 0 then 'overdue'
        when status = 'draft' then 'draft'
        else 'sent'
      end,
      paid_at = case when total_value > 0 and greatest(total_value - paid_value, 0) = 0 and paid_at is null then now() else paid_at end,
      updated_at = now()
  where id = target_invoice_id;
end;
$$;

create or replace function public.after_quote_line_item_change()
returns trigger
language plpgsql
as $$
begin
  perform public.recalculate_quote_totals(coalesce(new.quote_id, old.quote_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.after_invoice_line_or_payment_change()
returns trigger
language plpgsql
as $$
begin
  perform public.recalculate_invoice_totals(coalesce(new.invoice_id, old.invoice_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.prepare_invoice_before_write()
returns trigger
language plpgsql
as $$
begin
  new.total_amount = coalesce(new.subtotal, 0) + coalesce(new.tax_amount, 0);
  new.balance_due = greatest(coalesce(new.total_amount, 0) - coalesce(new.amount_paid, 0), 0);
  if new.status in ('sent','partially_paid','paid','overdue') and new.sent_at is null then
    new.sent_at = now();
  end if;
  if new.balance_due = 0 and new.total_amount > 0 then
    new.status = 'paid';
    if new.paid_at is null then new.paid_at = now(); end if;
  elsif new.amount_paid > 0 then
    new.status = 'partially_paid';
  elsif new.due_date < current_date and new.status <> 'void' then
    new.status = 'overdue';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_users_profile_updated_at on public.users_profile;
create trigger trg_users_profile_updated_at before update on public.users_profile for each row execute function public.set_updated_at();
drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
drop trigger if exists trg_locations_updated_at on public.locations;
create trigger trg_locations_updated_at before update on public.locations for each row execute function public.set_updated_at();
drop trigger if exists trg_subcontractors_updated_at on public.subcontractors;
create trigger trg_subcontractors_updated_at before update on public.subcontractors for each row execute function public.set_updated_at();
drop trigger if exists trg_work_orders_updated_at on public.work_orders;
create trigger trg_work_orders_updated_at before update on public.work_orders for each row execute function public.set_updated_at();
drop trigger if exists trg_work_orders_status_timestamps on public.work_orders;
create trigger trg_work_orders_status_timestamps before insert or update of status on public.work_orders for each row execute function public.set_work_order_status_timestamps();
drop trigger if exists trg_quotes_updated_at on public.quotes;
create trigger trg_quotes_updated_at before update on public.quotes for each row execute function public.set_updated_at();
drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at before update on public.invoices for each row execute function public.set_updated_at();
drop trigger if exists trg_invoices_prepare on public.invoices;
create trigger trg_invoices_prepare before insert or update on public.invoices for each row execute function public.prepare_invoice_before_write();
drop trigger if exists trg_contracts_updated_at on public.maintenance_contracts;
create trigger trg_contracts_updated_at before update on public.maintenance_contracts for each row execute function public.set_updated_at();
drop trigger if exists trg_visits_updated_at on public.maintenance_visits;
create trigger trg_visits_updated_at before update on public.maintenance_visits for each row execute function public.set_updated_at();
drop trigger if exists trg_quote_line_item_total on public.quote_line_items;
create trigger trg_quote_line_item_total before insert or update on public.quote_line_items for each row execute function public.set_line_item_total();
drop trigger if exists trg_invoice_line_item_total on public.invoice_line_items;
create trigger trg_invoice_line_item_total before insert or update on public.invoice_line_items for each row execute function public.set_line_item_total();
drop trigger if exists trg_quote_line_item_after on public.quote_line_items;
create trigger trg_quote_line_item_after after insert or update or delete on public.quote_line_items for each row execute function public.after_quote_line_item_change();
drop trigger if exists trg_invoice_line_item_after on public.invoice_line_items;
create trigger trg_invoice_line_item_after after insert or update or delete on public.invoice_line_items for each row execute function public.after_invoice_line_or_payment_change();
drop trigger if exists trg_payment_after on public.payments;
create trigger trg_payment_after after insert or update or delete on public.payments for each row execute function public.after_invoice_line_or_payment_change();

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users_profile where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_owner_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('owner','admin'), false);
$$;

create or replace function public.is_dispatch_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('owner','admin','dispatcher'), false);
$$;

alter table public.users_profile enable row level security;
alter table public.customers enable row level security;
alter table public.locations enable row level security;
alter table public.subcontractors enable row level security;
alter table public.work_orders enable row level security;
alter table public.work_order_photos enable row level security;
alter table public.work_order_documents enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_line_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.payments enable row level security;
alter table public.job_costs enable row level security;
alter table public.maintenance_contracts enable row level security;
alter table public.maintenance_visits enable row level security;

-- Recreate policies idempotently.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy "profiles_select_own_or_admin" on public.users_profile for select to authenticated using (auth_user_id = auth.uid() or public.is_owner_admin());
create policy "profiles_insert_own" on public.users_profile for insert to authenticated with check (auth_user_id = auth.uid() or public.is_owner_admin());
create policy "profiles_update_own_or_admin" on public.users_profile for update to authenticated using (auth_user_id = auth.uid() or public.is_owner_admin()) with check (auth_user_id = auth.uid() or public.is_owner_admin());

create policy "staff_all_customers" on public.customers for all to authenticated using (public.is_dispatch_staff()) with check (public.is_dispatch_staff());
create policy "customer_select_self" on public.customers for select to authenticated using (lower(coalesce(contact_email, billing_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "staff_all_locations" on public.locations for all to authenticated using (public.is_dispatch_staff()) with check (public.is_dispatch_staff());
create policy "customer_select_locations" on public.locations for select to authenticated using (exists (select 1 from public.customers c where c.id = locations.customer_id and lower(coalesce(c.contact_email, c.billing_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))));

create policy "staff_all_subcontractors" on public.subcontractors for all to authenticated using (public.is_dispatch_staff()) with check (public.is_dispatch_staff());
create policy "subcontractor_select_self" on public.subcontractors for select to authenticated using (lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "staff_all_work_orders" on public.work_orders for all to authenticated using (public.is_dispatch_staff()) with check (public.is_dispatch_staff());
create policy "subcontractor_select_assigned_work_orders" on public.work_orders for select to authenticated using (exists (select 1 from public.subcontractors s where s.id = work_orders.subcontractor_id and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))));
create policy "customer_select_own_work_orders" on public.work_orders for select to authenticated using (exists (select 1 from public.customers c where c.id = work_orders.customer_id and lower(coalesce(c.contact_email, c.billing_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))));

create policy "staff_all_photos" on public.work_order_photos for all to authenticated using (public.is_dispatch_staff()) with check (public.is_dispatch_staff());
create policy "assigned_parties_select_photos" on public.work_order_photos for select to authenticated using (exists (select 1 from public.work_orders wo where wo.id = work_order_photos.work_order_id and (exists (select 1 from public.subcontractors s where s.id = wo.subcontractor_id and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))) or exists (select 1 from public.customers c where c.id = wo.customer_id and lower(coalesce(c.contact_email, c.billing_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))))));
create policy "staff_all_documents" on public.work_order_documents for all to authenticated using (public.is_dispatch_staff()) with check (public.is_dispatch_staff());
create policy "assigned_parties_select_documents" on public.work_order_documents for select to authenticated using (exists (select 1 from public.work_orders wo where wo.id = work_order_documents.work_order_id and (exists (select 1 from public.subcontractors s where s.id = wo.subcontractor_id and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))) or exists (select 1 from public.customers c where c.id = wo.customer_id and lower(coalesce(c.contact_email, c.billing_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))))));

create policy "staff_all_quotes" on public.quotes for all to authenticated using (public.is_dispatch_staff()) with check (public.is_dispatch_staff());
create policy "customer_select_own_quotes" on public.quotes for select to authenticated using (exists (select 1 from public.customers c where c.id = quotes.customer_id and lower(coalesce(c.contact_email, c.billing_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))));
create policy "staff_all_quote_line_items" on public.quote_line_items for all to authenticated using (public.is_dispatch_staff()) with check (public.is_dispatch_staff());
create policy "customer_select_quote_line_items" on public.quote_line_items for select to authenticated using (exists (select 1 from public.quotes q join public.customers c on c.id = q.customer_id where q.id = quote_line_items.quote_id and lower(coalesce(c.contact_email, c.billing_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))));

create policy "staff_all_invoices" on public.invoices for all to authenticated using (public.is_dispatch_staff()) with check (public.is_dispatch_staff());
create policy "customer_select_own_invoices" on public.invoices for select to authenticated using (exists (select 1 from public.customers c where c.id = invoices.customer_id and lower(coalesce(c.contact_email, c.billing_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))));
create policy "staff_all_invoice_line_items" on public.invoice_line_items for all to authenticated using (public.is_dispatch_staff()) with check (public.is_dispatch_staff());
create policy "customer_select_invoice_line_items" on public.invoice_line_items for select to authenticated using (exists (select 1 from public.invoices i join public.customers c on c.id = i.customer_id where i.id = invoice_line_items.invoice_id and lower(coalesce(c.contact_email, c.billing_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))));
create policy "staff_all_payments" on public.payments for all to authenticated using (public.is_dispatch_staff()) with check (public.is_dispatch_staff());
create policy "customer_select_payments" on public.payments for select to authenticated using (exists (select 1 from public.customers c where c.id = payments.customer_id and lower(coalesce(c.contact_email, c.billing_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))));

create policy "staff_all_job_costs" on public.job_costs for all to authenticated using (public.is_dispatch_staff()) with check (public.is_dispatch_staff());
create policy "subcontractor_select_own_job_costs" on public.job_costs for select to authenticated using (exists (select 1 from public.subcontractors s where s.id = job_costs.subcontractor_id and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))));

create policy "staff_all_contracts" on public.maintenance_contracts for all to authenticated using (public.is_dispatch_staff()) with check (public.is_dispatch_staff());
create policy "customer_select_contracts" on public.maintenance_contracts for select to authenticated using (exists (select 1 from public.customers c where c.id = maintenance_contracts.customer_id and lower(coalesce(c.contact_email, c.billing_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))));
create policy "staff_all_visits" on public.maintenance_visits for all to authenticated using (public.is_dispatch_staff()) with check (public.is_dispatch_staff());
create policy "customer_select_visits" on public.maintenance_visits for select to authenticated using (exists (select 1 from public.maintenance_contracts mc join public.customers c on c.id = mc.customer_id where mc.id = maintenance_visits.maintenance_contract_id and lower(coalesce(c.contact_email, c.billing_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))));

insert into storage.buckets (id, name, public)
values ('work-order-photos', 'work-order-photos', true), ('work-order-documents', 'work-order-documents', true)
on conflict (id) do nothing;

drop policy if exists "staff_manage_work_order_photos_bucket" on storage.objects;
drop policy if exists "staff_manage_work_order_documents_bucket" on storage.objects;
create policy "staff_manage_work_order_photos_bucket" on storage.objects for all to authenticated using (bucket_id = 'work-order-photos' and public.is_dispatch_staff()) with check (bucket_id = 'work-order-photos' and public.is_dispatch_staff());
create policy "staff_manage_work_order_documents_bucket" on storage.objects for all to authenticated using (bucket_id = 'work-order-documents' and public.is_dispatch_staff()) with check (bucket_id = 'work-order-documents' and public.is_dispatch_staff());
