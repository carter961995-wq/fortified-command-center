-- Command map enrichment for geographic dispatch and sourcing workflows.
alter table public.subcontractors
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists service_latitude numeric(9,6),
  add column if not exists service_longitude numeric(9,6),
  add column if not exists active_cities text[] not null default '{}',
  add column if not exists pricing_tier text,
  add column if not exists waits_for_corporate_payout boolean not null default false,
  add column if not exists historical_performance_log text,
  add column if not exists source_website text,
  add column if not exists archived_at timestamptz;

create index if not exists subcontractors_command_map_state_idx
  on public.subcontractors (state)
  where archived_at is null;

create index if not exists subcontractors_command_map_location_idx
  on public.subcontractors (service_latitude, service_longitude)
  where archived_at is null;

create index if not exists subcontractors_command_map_active_cities_idx
  on public.subcontractors using gin(active_cities);
