-- Provider cost tracking: one row per paid AI call (estimates; reconcile with invoices).
-- No client access; finance staff can read.
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  feature text not null,
  provider text not null,
  model text,
  units numeric not null default 0,
  unit text not null,
  est_cost_usd numeric(12, 6) not null default 0,
  ok boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_usage_time on public.usage_events (created_at desc);
create index idx_usage_user on public.usage_events (user_id);
alter table public.usage_events enable row level security;
create policy "usage: finance read" on public.usage_events for select to authenticated
  using (private.has_role('finance'));
