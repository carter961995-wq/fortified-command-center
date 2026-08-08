-- Job intake records for Gmail / mHelpDesk assignment parsing and tracking.
-- Local demo mode also stores these under .fortified-data/job-intake.json.

create table if not exists public.job_intake_records (
  id uuid primary key default uuid_generate_v4(),
  status text not null default 'new' check (status in ('new', 'reviewed', 'tracked', 'dismissed')),
  source text not null check (source in ('gmail', 'mhelpdesk', 'manual')),
  source_ref text not null,
  received_at timestamptz not null default now(),
  subject text,
  from_address text,
  snippet text,
  raw_text text not null default '',
  parsed jsonb not null default '{}'::jsonb,
  notes text not null default '',
  scheduled_date date,
  photo_urls text[] not null default '{}',
  work_order_id uuid references public.work_orders(id) on delete set null,
  email_draft jsonb,
  mhelpdesk_push jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_ref)
);

create index if not exists idx_job_intake_status on public.job_intake_records(status);
create index if not exists idx_job_intake_received on public.job_intake_records(received_at desc);
create index if not exists idx_job_intake_work_order on public.job_intake_records(work_order_id);

alter table public.job_intake_records enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'job_intake_records'
      and policyname = 'Staff can manage job intake'
  ) then
    create policy "Staff can manage job intake"
      on public.job_intake_records
      for all
      using (true)
      with check (true);
  end if;
end $$;
