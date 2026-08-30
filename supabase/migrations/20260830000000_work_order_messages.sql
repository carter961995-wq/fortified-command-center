create table if not exists public.work_order_messages (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  channel text not null default 'note',
  direction text not null default 'outbound',
  body text not null,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.work_order_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'work_order_messages' and policyname = 'staff_all_work_order_messages'
  ) then
    create policy staff_all_work_order_messages on public.work_order_messages
      for all using (true) with check (true);
  end if;
end $$;
