-- Fortified Work Order Command Center — initial schema
-- Run via Supabase CLI: supabase db push / SQL editor

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_staff_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users_profile up
    WHERE up.auth_user_id = auth.uid()
      AND up.role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users_profile (auth_user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'admin'
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users_profile.full_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ---------------------------------------------------------------------------
-- users_profile
-- ---------------------------------------------------------------------------

CREATE TABLE public.users_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'dispatcher', 'subcontractor', 'customer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_profile_auth_user_id_idx ON public.users_profile (auth_user_id);

CREATE TRIGGER users_profile_set_updated_at
  BEFORE UPDATE ON public.users_profile
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  billing_email text,
  billing_address text,
  payment_terms text,
  notes text,
  customer_type text NOT NULL DEFAULT 'commercial' CHECK (
    customer_type IN (
      'commercial', 'residential', 'facilities_network', 'property_manager',
      'government', 'school', 'retail', 'other'
    )
  ),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'prospect')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX customers_company_name_idx ON public.customers (lower(company_name));
CREATE INDEX customers_status_idx ON public.customers (status);

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------------

CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  location_name text NOT NULL,
  store_number text,
  address_line_1 text NOT NULL DEFAULT '',
  address_line_2 text,
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  zip text,
  gate_code text,
  access_instructions text,
  site_contact_name text,
  site_contact_phone text,
  site_contact_email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX locations_customer_id_idx ON public.locations (customer_id);
CREATE INDEX locations_state_city_idx ON public.locations (state, city);

CREATE TRIGGER locations_set_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- subcontractors
-- ---------------------------------------------------------------------------

CREATE TABLE public.subcontractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  owner_name text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  zip text,
  service_states text[] NOT NULL DEFAULT '{}',
  service_radius_miles numeric,
  trades text[] NOT NULL DEFAULT '{}',
  insurance_expiration date,
  w9_received boolean NOT NULL DEFAULT false,
  subcontractor_agreement_signed boolean NOT NULL DEFAULT false,
  coi_received boolean NOT NULL DEFAULT false,
  preferred_vendor boolean NOT NULL DEFAULT false,
  dedicated_region text,
  standard_labor_rate numeric,
  emergency_labor_rate numeric,
  trip_charge numeric,
  notes text,
  quality_score numeric,
  response_score numeric,
  callback_count integer NOT NULL DEFAULT 0,
  jobs_completed integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'probation', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subcontractors_company_name_idx ON public.subcontractors (lower(company_name));
CREATE INDEX subcontractors_status_idx ON public.subcontractors (status);

CREATE TRIGGER subcontractors_set_updated_at
  BEFORE UPDATE ON public.subcontractors
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- work_orders
-- ---------------------------------------------------------------------------

CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES public.locations (id) ON DELETE RESTRICT,
  subcontractor_id uuid REFERENCES public.subcontractors (id) ON DELETE SET NULL,
  title text NOT NULL,
  scope_summary text,
  trade_type text NOT NULL DEFAULT 'fence',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent', 'emergency')),
  status text NOT NULL DEFAULT 'New' CHECK (status IN (
    'New', 'Needs Site Info', 'Waiting on Sub Quote', 'Quote Needed', 'Quote Sent',
    'Approved', 'Scheduled', 'In Progress', 'Completed by Sub', 'Needs Review',
    'Ready to Invoice', 'Invoiced', 'Paid', 'Closed', 'Callback/Warranty', 'Cancelled'
  )),
  source text NOT NULL DEFAULT 'direct' CHECK (source IN (
    'direct', 'AGM', 'Home Depot', 'facilities_network', 'website', 'phone', 'referral', 'other'
  )),
  customer_work_order_number text,
  purchase_order_number text,
  not_to_exceed_amount numeric,
  requested_date date,
  due_date date,
  scheduled_date date,
  completed_date date,
  customer_approved_at timestamptz,
  invoice_sent_at timestamptz,
  paid_at timestamptz,
  internal_notes text,
  customer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX work_orders_customer_id_idx ON public.work_orders (customer_id);
CREATE INDEX work_orders_location_id_idx ON public.work_orders (location_id);
CREATE INDEX work_orders_subcontractor_id_idx ON public.work_orders (subcontractor_id);
CREATE INDEX work_orders_status_idx ON public.work_orders (status);
CREATE INDEX work_orders_scheduled_date_idx ON public.work_orders (scheduled_date);

CREATE TRIGGER work_orders_set_updated_at
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- work_order_photos & work_order_documents
-- ---------------------------------------------------------------------------

CREATE TABLE public.work_order_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders (id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  photo_type text NOT NULL DEFAULT 'other' CHECK (photo_type IN ('before', 'during', 'after', 'receipt', 'damage', 'other')),
  caption text,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX work_order_photos_work_order_id_idx ON public.work_order_photos (work_order_id);

CREATE TABLE public.work_order_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders (id) ON DELETE CASCADE,
  document_url text NOT NULL,
  document_type text NOT NULL DEFAULT 'other' CHECK (document_type IN (
    'quote', 'invoice', 'receipt', 'completion_form', 'contract', 'other'
  )),
  filename text,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX work_order_documents_work_order_id_idx ON public.work_order_documents (work_order_id);

-- ---------------------------------------------------------------------------
-- quotes
-- ---------------------------------------------------------------------------

CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text NOT NULL UNIQUE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES public.locations (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'expired')),
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  customer_message text,
  internal_notes text,
  valid_until date,
  sent_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quotes_work_order_id_idx ON public.quotes (work_order_id);
CREATE INDEX quotes_customer_id_idx ON public.quotes (customer_id);

CREATE TRIGGER quotes_set_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE public.quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0
);

CREATE INDEX quote_line_items_quote_id_idx ON public.quote_line_items (quote_id);

-- ---------------------------------------------------------------------------
-- invoices & payments
-- ---------------------------------------------------------------------------

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders (id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES public.locations (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void')),
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  balance_due numeric NOT NULL DEFAULT 0,
  invoice_date date NOT NULL DEFAULT (timezone('utc', now()))::date,
  due_date date,
  sent_at timestamptz,
  paid_at timestamptz,
  payment_terms text,
  pdf_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invoices_work_order_id_idx ON public.invoices (work_order_id);
CREATE INDEX invoices_customer_id_idx ON public.invoices (customer_id);
CREATE INDEX invoices_status_idx ON public.invoices (status);
CREATE INDEX invoices_invoice_date_idx ON public.invoices (invoice_date);

CREATE TRIGGER invoices_set_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0
);

CREATE INDEX invoice_line_items_invoice_id_idx ON public.invoice_line_items (invoice_id);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  amount numeric NOT NULL,
  payment_date date NOT NULL DEFAULT (timezone('utc', now()))::date,
  payment_method text NOT NULL DEFAULT 'other' CHECK (payment_method IN ('cash', 'check', 'ach', 'card', 'wire', 'other')),
  reference_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payments_invoice_id_idx ON public.payments (invoice_id);

-- ---------------------------------------------------------------------------
-- job_costs
-- ---------------------------------------------------------------------------

CREATE TABLE public.job_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders (id) ON DELETE CASCADE,
  subcontractor_id uuid REFERENCES public.subcontractors (id) ON DELETE SET NULL,
  cost_type text NOT NULL CHECK (cost_type IN (
    'subcontractor', 'materials', 'equipment', 'travel', 'permit', 'other'
  )),
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  receipt_url text,
  paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_costs_work_order_id_idx ON public.job_costs (work_order_id);

-- ---------------------------------------------------------------------------
-- maintenance
-- ---------------------------------------------------------------------------

CREATE TABLE public.maintenance_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations (id) ON DELETE SET NULL,
  contract_name text NOT NULL,
  plan_type text NOT NULL DEFAULT 'basic' CHECK (plan_type IN ('basic', 'pro', 'multi_site', 'custom')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'cancelled', 'expired')),
  start_date date NOT NULL,
  end_date date,
  billing_frequency text NOT NULL DEFAULT 'monthly' CHECK (billing_frequency IN ('monthly', 'quarterly', 'annually')),
  recurring_amount numeric NOT NULL DEFAULT 0,
  inspection_frequency text NOT NULL DEFAULT 'quarterly' CHECK (
    inspection_frequency IN ('monthly', 'quarterly', 'semiannual', 'annual')
  ),
  included_services text,
  excluded_services text,
  priority_dispatch boolean NOT NULL DEFAULT false,
  discount_percent numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX maintenance_contracts_customer_id_idx ON public.maintenance_contracts (customer_id);

CREATE TRIGGER maintenance_contracts_set_updated_at
  BEFORE UPDATE ON public.maintenance_contracts
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE public.maintenance_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_contract_id uuid NOT NULL REFERENCES public.maintenance_contracts (id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES public.work_orders (id) ON DELETE SET NULL,
  scheduled_date date NOT NULL,
  completed_date date,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'missed', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX maintenance_visits_contract_id_idx ON public.maintenance_visits (maintenance_contract_id);

CREATE TRIGGER maintenance_visits_set_updated_at
  BEFORE UPDATE ON public.maintenance_visits
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Financial view (per work order)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.work_order_financials AS
SELECT
  wo.id AS work_order_id,
  COALESCE(inv.invoice_total, 0)::numeric AS invoice_total,
  COALESCE(jc.job_cost_total, 0)::numeric AS total_job_costs,
  (COALESCE(inv.invoice_total, 0) - COALESCE(jc.job_cost_total, 0))::numeric AS gross_profit,
  CASE
    WHEN COALESCE(inv.invoice_total, 0) > 0 THEN
      round(
        (COALESCE(inv.invoice_total, 0) - COALESCE(jc.job_cost_total, 0))
        / COALESCE(inv.invoice_total, 0) * 100::numeric,
        2
      )
    ELSE 0::numeric
  END AS gross_margin_pct
FROM public.work_orders wo
LEFT JOIN LATERAL (
  SELECT sum(i.total_amount) FILTER (WHERE i.status <> 'void') AS invoice_total
  FROM public.invoices i
  WHERE i.work_order_id = wo.id
) inv ON true
LEFT JOIN LATERAL (
  SELECT sum(c.amount) AS job_cost_total
  FROM public.job_costs c
  WHERE c.work_order_id = wo.id
) jc ON true;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_profile_select ON public.users_profile
  FOR SELECT TO authenticated USING (auth_user_id = auth.uid() OR public.is_staff_admin());

CREATE POLICY users_profile_insert ON public.users_profile
  FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid() OR public.is_staff_admin());

CREATE POLICY users_profile_update ON public.users_profile
  FOR UPDATE TO authenticated USING (auth_user_id = auth.uid() OR public.is_staff_admin())
  WITH CHECK (auth_user_id = auth.uid() OR public.is_staff_admin());

CREATE POLICY users_profile_delete ON public.users_profile
  FOR DELETE TO authenticated USING (public.is_staff_admin());

-- Staff admin full access on operational tables
CREATE POLICY customers_all ON public.customers FOR ALL TO authenticated
  USING (public.is_staff_admin()) WITH CHECK (public.is_staff_admin());

CREATE POLICY locations_all ON public.locations FOR ALL TO authenticated
  USING (public.is_staff_admin()) WITH CHECK (public.is_staff_admin());

CREATE POLICY subcontractors_all ON public.subcontractors FOR ALL TO authenticated
  USING (public.is_staff_admin()) WITH CHECK (public.is_staff_admin());

CREATE POLICY work_orders_all ON public.work_orders FOR ALL TO authenticated
  USING (public.is_staff_admin()) WITH CHECK (public.is_staff_admin());

CREATE POLICY work_order_photos_all ON public.work_order_photos FOR ALL TO authenticated
  USING (public.is_staff_admin()) WITH CHECK (public.is_staff_admin());

CREATE POLICY work_order_documents_all ON public.work_order_documents FOR ALL TO authenticated
  USING (public.is_staff_admin()) WITH CHECK (public.is_staff_admin());

CREATE POLICY quotes_all ON public.quotes FOR ALL TO authenticated
  USING (public.is_staff_admin()) WITH CHECK (public.is_staff_admin());

CREATE POLICY quote_line_items_all ON public.quote_line_items FOR ALL TO authenticated
  USING (public.is_staff_admin()) WITH CHECK (public.is_staff_admin());

CREATE POLICY invoices_all ON public.invoices FOR ALL TO authenticated
  USING (public.is_staff_admin()) WITH CHECK (public.is_staff_admin());

CREATE POLICY invoice_line_items_all ON public.invoice_line_items FOR ALL TO authenticated
  USING (public.is_staff_admin()) WITH CHECK (public.is_staff_admin());

CREATE POLICY payments_all ON public.payments FOR ALL TO authenticated
  USING (public.is_staff_admin()) WITH CHECK (public.is_staff_admin());

CREATE POLICY job_costs_all ON public.job_costs FOR ALL TO authenticated
  USING (public.is_staff_admin()) WITH CHECK (public.is_staff_admin());

CREATE POLICY maintenance_contracts_all ON public.maintenance_contracts FOR ALL TO authenticated
  USING (public.is_staff_admin()) WITH CHECK (public.is_staff_admin());

CREATE POLICY maintenance_visits_all ON public.maintenance_visits FOR ALL TO authenticated
  USING (public.is_staff_admin()) WITH CHECK (public.is_staff_admin());

GRANT USAGE ON SCHEMA public TO postgres, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.work_order_financials TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('work-order-files', 'work-order-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "staff read invoices bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoices' AND public.is_staff_admin());

CREATE POLICY "staff upload invoices bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoices' AND public.is_staff_admin());

CREATE POLICY "staff update invoices bucket"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'invoices' AND public.is_staff_admin());

CREATE POLICY "staff read work order files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'work-order-files' AND public.is_staff_admin());

CREATE POLICY "staff upload work order files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'work-order-files' AND public.is_staff_admin());

CREATE POLICY "staff update work order files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'work-order-files' AND public.is_staff_admin());

CREATE POLICY "staff delete work order files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'work-order-files' AND public.is_staff_admin());

-- Service role bypasses RLS; server-side PDF upload uses service role.

-- ---------------------------------------------------------------------------
-- Seed data (deterministic UUIDs)
-- ---------------------------------------------------------------------------

INSERT INTO public.customers (id, company_name, contact_name, contact_email, contact_phone, billing_email, billing_address, payment_terms, notes, customer_type, status)
VALUES
  ('a0000001-0001-0001-0001-000000000001'::uuid, 'AGM / Home Depot Account', 'Regional Facilities', 'facilities@example.com', '555-0101', 'billing-agm@example.com', '100 Retail Parkway, Dallas, TX 75201', 'Net 30', 'National rollouts and remodel support.', 'retail', 'active'),
  ('a0000001-0001-0001-0001-000000000002'::uuid, 'GameStop Example Account', 'Loss Prevention', 'lp@example.com', '555-0102', 'billing-gs@example.com', '625 Westport Parkway, Grapevine, TX 76051', 'Net 45', 'Pilot account for store security upgrades.', 'retail', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.locations (id, customer_id, location_name, store_number, address_line_1, city, state, zip, gate_code, access_instructions, site_contact_name, site_contact_phone)
VALUES
  ('b0000002-0002-0002-0002-000000000001'::uuid, 'a0000001-0001-0001-0001-000000000001'::uuid, 'Home Depot #4421', '4421', '500 Commerce Drive', 'Shreveport', 'LA', '71106', '1234#', 'Call store manager 15 minutes prior to arrival.', 'Night Manager', '555-0201'),
  ('b0000002-0002-0002-0002-000000000002'::uuid, 'a0000001-0001-0001-0001-000000000001'::uuid, 'Home Depot #8890', '8890', '1200 Industrial Blvd', 'Little Rock', 'AR', '72209', NULL, 'Use contractor entrance on east side.', 'Receiving Lead', '555-0202'),
  ('b0000002-0002-0002-0002-000000000003'::uuid, 'a0000001-0001-0001-0001-000000000002'::uuid, 'GameStop #1844', '1844', '4100 Ambassador Caffery Pkwy', 'Lafayette', 'LA', '70508', NULL, 'Mall security escort required after 8pm.', 'Store Manager', '555-0203')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.subcontractors (id, company_name, owner_name, phone, email, address, city, state, zip, service_states, trades, w9_received, subcontractor_agreement_signed, coi_received, preferred_vendor, quality_score, response_score, callback_count, jobs_completed, status)
VALUES
  ('c0000003-0003-0003-0003-000000000001'::uuid, '9Line Fence', 'Chris Mercer', '555-0301', 'dispatch@9linefence.example', '88 Contractor Lane', 'Bossier City', 'LA', '71111',
   ARRAY['LA','AR','TX']::text[],
   ARRAY['fence','gate','welding','security_grille','chain_link']::text[],
   true, true, true, true, 4.6, 4.4, 1, 128, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.work_orders (id, work_order_number, customer_id, location_id, subcontractor_id, title, scope_summary, trade_type, priority, status, source, customer_work_order_number, purchase_order_number, not_to_exceed_amount, requested_date, due_date, scheduled_date, internal_notes, customer_notes)
VALUES
  ('d0000004-0004-0004-0004-000000000001'::uuid, 'WO-2026-0001', 'a0000001-0001-0001-0001-000000000001'::uuid, 'b0000002-0002-0002-0002-000000000001'::uuid, 'c0000003-0003-0003-0003-000000000001'::uuid,
   'Security grille replacement', 'Remove damaged grille, fabricate and install heavy-duty steel security grille to match existing opening. Touch-up paint.', 'security_grille', 'urgent', 'In Progress', 'AGM', 'AGM-77821', 'PO-99231', 18500, '2026-05-01', '2026-05-20', '2026-05-18',
   'Customer requires photo documentation before/after.', 'After-hours work authorized up to 4 hours.'),

  ('d0000004-0004-0004-0004-000000000002'::uuid, 'WO-2026-0002', 'a0000001-0001-0001-0001-000000000001'::uuid, 'b0000002-0002-0002-0002-000000000002'::uuid, 'c0000003-0003-0003-0003-000000000001'::uuid,
   'Commercial gate repair', 'Repair dual swing gate — damaged hinge, realign operators, replace worn rollers, test safety edges.', 'gate', 'normal', 'Waiting on Sub Quote', 'Home Depot', 'HD-WO-44102', NULL, 9200, '2026-05-10', '2026-06-01', NULL,
   'Waiting on 9Line expected labor + materials.', NULL),

  ('d0000004-0004-0004-0004-000000000003'::uuid, 'WO-2026-0003', 'a0000001-0001-0001-0001-000000000002'::uuid, 'b0000002-0002-0002-0002-000000000003'::uuid, NULL,
   'Chain link fence repair', 'Replace 40 LF damaged chain link, two terminal posts, tension wire, and top rail per site LP standards.', 'chain_link', 'normal', 'New', 'direct', 'GS-LP-1044', NULL, 4500, '2026-05-12', '2026-05-30', NULL,
   'Assign preferred vendor once scope validated.', 'Coordinate with mall management for parking.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.job_costs (id, work_order_id, subcontractor_id, cost_type, description, amount, paid)
VALUES
  ('f0000006-0006-0006-0006-000000000001'::uuid, 'd0000004-0004-0004-0004-000000000001'::uuid, 'c0000003-0003-0003-0003-000000000001'::uuid, 'subcontractor', '9Line — fab & install (estimate)', 11200, false),
  ('f0000006-0006-0006-0006-000000000002'::uuid, 'd0000004-0004-0004-0004-000000000001'::uuid, NULL, 'materials', 'Powder coat & hardware allowance', 850, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.maintenance_contracts (id, customer_id, location_id, contract_name, plan_type, status, start_date, end_date, billing_frequency, recurring_amount, inspection_frequency, included_services, excluded_services, priority_dispatch, discount_percent, notes)
VALUES
  ('e0000005-0005-0005-0005-000000000001'::uuid, 'a0000001-0001-0001-0001-000000000001'::uuid, 'b0000002-0002-0002-0002-000000000001'::uuid,
   'HD4421 — Quarterly Perimeter Care', 'pro', 'active', '2026-01-01', '2026-12-31', 'quarterly', 2400, 'quarterly',
   'Walk perimeter, hinge/latch inspection, operator function test.', 'Structural concrete repairs.', true, 5, 'Renewal option Jan 2027.')
ON CONFLICT (id) DO NOTHING;
