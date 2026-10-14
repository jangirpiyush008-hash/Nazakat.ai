-- V1.1: AI photos, AI videos, voice calls, Sparks charging, welcome Sparks.
-- RLS on every new table. Clients can only READ their own rows; all writes
-- go through the server (service role) after safety checks and charging.

-- Companion fields used to build image/video prompts and pick a voice.
alter table public.companions add column if not exists appearance text;
alter table public.companions add column if not exists voice_id text;

create type public.media_kind as enum ('image', 'video');
create type public.job_status as enum ('queued', 'running', 'finishing', 'succeeded', 'failed', 'blocked', 'canceled');

-- Generated media (private; served through short-lived signed URLs).
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  companion_id uuid not null references public.companions (id) on delete cascade,
  kind public.media_kind not null,
  storage_path text not null unique,
  content_type text not null,
  width int,
  height int,
  duration_s int,
  prompt text not null,
  ai_generated boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.media_assets
  for each row execute function extensions.moddatetime(updated_at);
create index idx_media_user_time on public.media_assets (user_id, created_at desc); -- gallery
create index idx_media_companion on public.media_assets (companion_id); -- FK
alter table public.media_assets enable row level security;
create policy "media: read own" on public.media_assets for select to authenticated
  using ((select auth.uid()) = user_id);
-- INSERT / UPDATE / DELETE: none for clients (server writes and deletes storage too).

-- Generation jobs (one per photo/video request).
create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  companion_id uuid not null references public.companions (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  kind public.media_kind not null,
  prompt text not null check (char_length(prompt) between 2 and 600),
  duration_s int check (duration_s in (5, 8, 10, 15)),
  status public.job_status not null default 'queued',
  sparks_cost int not null check (sparks_cost >= 0),
  provider text not null,
  model text not null,
  provider_request_id text,
  status_url text,
  response_url text,
  media_id uuid references public.media_assets (id) on delete set null,
  error_code text,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.generation_jobs
  for each row execute function extensions.moddatetime(updated_at);
create index idx_jobs_user_time on public.generation_jobs (user_id, created_at desc); -- history
create index idx_jobs_companion on public.generation_jobs (companion_id); -- FK
create index idx_jobs_conversation on public.generation_jobs (conversation_id); -- FK
create index idx_jobs_media on public.generation_jobs (media_id); -- FK
alter table public.generation_jobs enable row level security;
create policy "jobs: read own" on public.generation_jobs for select to authenticated
  using ((select auth.uid()) = user_id);
-- INSERT / UPDATE / DELETE: none for clients.

-- Media can appear inside a conversation as a companion message.
alter table public.messages add column if not exists media_id uuid references public.media_assets (id) on delete set null;
create index if not exists idx_messages_media on public.messages (media_id); -- FK

-- Voice calls (audio is never stored; only timing and billing).
create table public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  companion_id uuid not null references public.companions (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'ended')),
  minutes_charged int not null default 0,
  sparks_per_minute int not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.call_sessions
  for each row execute function extensions.moddatetime(updated_at);
create index idx_calls_user_time on public.call_sessions (user_id, started_at desc); -- history
create index idx_calls_companion on public.call_sessions (companion_id); -- FK
create index idx_calls_conversation on public.call_sessions (conversation_id); -- FK
alter table public.call_sessions enable row level security;
create policy "calls: read own" on public.call_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
-- INSERT / UPDATE / DELETE: none for clients.

-- Private storage bucket for generated media. No client policies: the server
-- uploads with the service role and hands out short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('generations', 'generations', false)
on conflict (id) do nothing;

-- ── Sparks charging (service role only) ─────────────────────────────────
-- Charges `amount` Sparks if the balance covers it. Serialised per user with
-- an advisory lock so two parallel requests can't overspend. Idempotent on key.
create or replace function public.charge_sparks(uid uuid, amount int, key text, ref text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  bal int;
  promo int;
begin
  if amount <= 0 then
    return true;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  if exists (select 1 from public.credit_ledger l where l.idempotency_key = key) then
    return true;
  end if;
  select coalesce(sum(l.amount), 0) into bal from public.credit_ledger l
   where l.user_id = uid and (l.expires_at is null or l.expires_at > now());
  if bal < amount then
    return false;
  end if;
  select coalesce(sum(l.amount), 0) into promo from public.credit_ledger l
   where l.user_id = uid and l.bucket = 'promo' and (l.expires_at is null or l.expires_at > now());
  insert into public.credit_ledger (user_id, kind, bucket, amount, idempotency_key, reference)
  values (uid, 'consumption', case when promo >= amount then 'promo'::public.ledger_bucket else 'purchased'::public.ledger_bucket end, -amount, key, ref);
  return true;
end;
$$;

-- Returns Sparks for a failed/blocked action. Idempotent on key.
create or replace function public.refund_sparks(uid uuid, amount int, key text, ref text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.credit_ledger (user_id, kind, bucket, amount, idempotency_key, reference)
  select uid, 'refund', 'promo', amount, key, ref
  where amount > 0
  on conflict (idempotency_key) do nothing;
$$;

create or replace function public.spark_balance_of(uid uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(coalesce(sum(amount), 0), 0)::int from public.credit_ledger
   where user_id = uid and (expires_at is null or expires_at > now());
$$;

revoke execute on function public.charge_sparks(uuid, int, text, text) from public, anon, authenticated;
revoke execute on function public.refund_sparks(uuid, int, text, text) from public, anon, authenticated;
revoke execute on function public.spark_balance_of(uuid) from public, anon, authenticated;
grant execute on function public.charge_sparks(uuid, int, text, text) to service_role;
grant execute on function public.refund_sparks(uuid, int, text, text) to service_role;
grant execute on function public.spark_balance_of(uuid) to service_role;

-- Welcome Sparks: 50 promo Sparks, valid 30 days, granted once on onboarding.
create or replace function public.complete_onboarding(
  consent_version text,
  analytics boolean,
  marketing boolean,
  interest public.companion_gender,
  chat_language text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if chat_language not in ('hinglish', 'hindi', 'english') then
    raise exception 'invalid chat_language' using errcode = '22023';
  end if;

  insert into public.consent_records (user_id, consent_type, version, granted)
  values
    (uid, 'age_18_plus', consent_version, true),
    (uid, 'ai_disclosure', consent_version, true),
    (uid, 'terms', consent_version, true),
    (uid, 'privacy', consent_version, true),
    (uid, 'analytics', consent_version, analytics),
    (uid, 'marketing', consent_version, marketing);

  update public.profiles
     set age_confirmed_at = coalesce(age_confirmed_at, now()),
         onboarded_at = coalesce(onboarded_at, now()),
         interest = complete_onboarding.interest,
         chat_language = complete_onboarding.chat_language
   where id = uid;

  insert into public.credit_ledger (user_id, kind, bucket, amount, idempotency_key, reference, expires_at)
  values (uid, 'grant', 'promo', 50, 'welcome-' || uid::text, 'welcome', now() + interval '30 days')
  on conflict (idempotency_key) do nothing;
end;
$$;
