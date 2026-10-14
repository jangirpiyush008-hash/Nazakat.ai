-- Nazakat V1 core schema
--
--   auth.users ─1:1─ profiles
--        │            ├─< consent_records      (append-only)
--        │            ├─< conversations >─ companions ─1:1─ companion_personas (server-only)
--        │            │        └─< messages
--        │            ├─< memory_items >─ companions
--        │            ├─< credit_ledger        (append-only, server-written)
--        │            ├─< daily_usage          (server-written)
--        │            └─< reports
--        ├─< admin_roles
--        └─< audit_logs                         (server-written)
--
-- RLS is enabled on EVERY table. Where an operation has no policy, that is
-- deliberate and noted. Those writes happen only on the server with the
-- service role, after validation.

create extension if not exists moddatetime with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ── Enums ───────────────────────────────────────────────────────────────
create type public.app_role as enum ('support', 'moderator', 'content_editor', 'finance', 'super_admin');
create type public.companion_gender as enum ('women', 'men', 'anime');
create type public.companion_status as enum ('draft', 'published', 'archived');
create type public.message_role as enum ('user', 'assistant', 'system');
create type public.moderation_status as enum ('unchecked', 'passed', 'flagged', 'blocked');
create type public.memory_category as enum ('preference', 'place', 'name', 'date', 'other');
create type public.ledger_kind as enum ('grant', 'purchase', 'consumption', 'reservation', 'release', 'refund', 'adjustment');
create type public.ledger_bucket as enum ('purchased', 'promo', 'earned');
create type public.consent_type as enum ('terms', 'privacy', 'age_18_plus', 'ai_disclosure', 'analytics', 'marketing');
create type public.report_target as enum ('companion', 'message', 'media', 'account');
create type public.report_status as enum ('open', 'in_review', 'actioned', 'dismissed');

-- ── admin_roles (created first: the role helpers below read it) ────────
create table public.admin_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role)
);
create index idx_admin_roles_granted_by on public.admin_roles (granted_by); -- FK

-- ── Helpers (private schema, not exposed over the API) ───────────────────
create or replace function private.has_role(required public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_roles r
    where r.user_id = (select auth.uid())
      and (r.role = required or r.role = 'super_admin')
  );
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_roles r where r.user_id = (select auth.uid()));
$$;

grant usage on schema private to authenticated;
grant execute on function private.has_role(public.app_role), private.is_staff() to authenticated;

-- ── profiles ────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 40),
  interest public.companion_gender not null default 'women',
  chat_language text not null default 'hinglish' check (chat_language in ('hinglish', 'hindi', 'english')),
  ui_locale text not null default 'en-IN',
  timezone text not null default 'Asia/Kolkata',
  age_confirmed_at timestamptz,
  onboarded_at timestamptz,
  memory_enabled boolean not null default true,
  discreet_mode boolean not null default false,
  reduce_motion boolean not null default false,
  spicy_animations boolean not null default true,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.profiles
  for each row execute function extensions.moddatetime(updated_at);

alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- INSERT: none. Rows are created by the on_auth_user_created trigger.
-- DELETE: none. Account deletion is a server workflow (docs/RETENTION_AND_DELETION.md).
create policy "profiles: staff read" on public.profiles for select to authenticated
  using (private.has_role('support'));

-- Users must not set their own age confirmation or onboarding timestamps.
-- Those are written by the server after the consent step.
revoke update on public.profiles from authenticated;
grant update (display_name, interest, chat_language, ui_locale, timezone, memory_enabled,
              discreet_mode, reduce_motion, spicy_animations) on public.profiles to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ── consent_records (append-only history) ───────────────────────────────
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_type public.consent_type not null,
  version text not null,
  granted boolean not null,
  source text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_consent_user_type on public.consent_records (user_id, consent_type, created_at desc); -- latest decision per type

alter table public.consent_records enable row level security;
create policy "consent: read own" on public.consent_records for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "consent: record own" on public.consent_records for insert to authenticated
  with check ((select auth.uid()) = user_id);
-- UPDATE / DELETE: none. Withdrawal is a new row with granted = false, so the history stays intact.

-- ── companions (public catalogue) ───────────────────────────────────────
create table public.companions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  age int not null check (age >= 25), -- adults 25+ only (design brief)
  city text not null,
  occupation text not null,
  gender public.companion_gender not null,
  languages text[] not null default '{}',
  vibes text[] not null default '{}',
  interests text[] not null default '{}',
  traits text[] not null default '{}',
  hook text not null,
  quote text not null,
  bio text not null,
  badge text check (badge in ('hot', 'new')),
  wash text not null,
  portrait_path text,
  status public.companion_status not null default 'draft',
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.companions
  for each row execute function extensions.moddatetime(updated_at);
create index idx_companions_status_sort on public.companions (status, sort_order); -- catalogue listing

alter table public.companions enable row level security;
create policy "companions: public read published" on public.companions for select to anon, authenticated
  using (status = 'published');
create policy "companions: staff read all" on public.companions for select to authenticated
  using (private.has_role('content_editor'));
create policy "companions: editors insert" on public.companions for insert to authenticated
  with check (private.has_role('content_editor'));
create policy "companions: editors update" on public.companions for update to authenticated
  using (private.has_role('content_editor')) with check (private.has_role('content_editor'));
create policy "companions: super admin delete" on public.companions for delete to authenticated
  using (private.has_role('super_admin'));

-- Persona prompts are never readable by clients. No policies for anon or
-- authenticated; only the service role (server) reads them.
create table public.companion_personas (
  companion_id uuid primary key references public.companions (id) on delete cascade,
  system_prompt text not null,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.companion_personas
  for each row execute function extensions.moddatetime(updated_at);
alter table public.companion_personas enable row level security;
-- SELECT/INSERT/UPDATE/DELETE: none for clients (server-only).

-- ── conversations & messages ────────────────────────────────────────────
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  companion_id uuid not null references public.companions (id) on delete restrict,
  title text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.conversations
  for each row execute function extensions.moddatetime(updated_at);
create index idx_conversations_user_recent on public.conversations (user_id, last_message_at desc nulls last); -- chat list
create index idx_conversations_companion on public.conversations (companion_id); -- FK

alter table public.conversations enable row level security;
create policy "conversations: read own" on public.conversations for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "conversations: create own" on public.conversations for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "conversations: rename own" on public.conversations for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "conversations: delete own" on public.conversations for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke update on public.conversations from authenticated;
grant update (title) on public.conversations to authenticated;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.message_role not null,
  content text not null check (char_length(content) <= 8000),
  provider text,
  model text,
  provider_request_id text,
  input_tokens int,
  output_tokens int,
  moderation public.moderation_status not null default 'unchecked',
  feedback smallint check (feedback in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.messages
  for each row execute function extensions.moddatetime(updated_at);
create index idx_messages_conversation_time on public.messages (conversation_id, created_at); -- thread load
create index idx_messages_user on public.messages (user_id); -- FK + deletion cascade

alter table public.messages enable row level security;
create policy "messages: read own" on public.messages for select to authenticated
  using ((select auth.uid()) = user_id);
-- INSERT: none for clients. The chat API validates, moderates, meters and
-- writes both the user turn and the assistant turn with the service role.
create policy "messages: feedback on own" on public.messages for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke update on public.messages from authenticated;
grant update (feedback) on public.messages to authenticated;
create policy "messages: delete own" on public.messages for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ── memory_items ────────────────────────────────────────────────────────
create table public.memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  companion_id uuid not null references public.companions (id) on delete cascade,
  fact text not null check (char_length(fact) between 2 and 200),
  category public.memory_category not null default 'other',
  source_message_id uuid references public.messages (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.memory_items
  for each row execute function extensions.moddatetime(updated_at);
create index idx_memory_user_companion on public.memory_items (user_id, companion_id, created_at desc); -- memory panel + prompt retrieval
create index idx_memory_companion on public.memory_items (companion_id); -- FK
create index idx_memory_source_message on public.memory_items (source_message_id); -- FK

alter table public.memory_items enable row level security;
create policy "memory: read own" on public.memory_items for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "memory: add own" on public.memory_items for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "memory: edit own" on public.memory_items for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "memory: forget own" on public.memory_items for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ── Sparks ledger (append-only, server-authoritative) ───────────────────
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.ledger_kind not null,
  bucket public.ledger_bucket not null,
  amount int not null check (amount <> 0), -- +credit / −debit
  idempotency_key text not null unique,
  reference text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_ledger_user_time on public.credit_ledger (user_id, created_at desc); -- history + balance

alter table public.credit_ledger enable row level security;
create policy "ledger: read own" on public.credit_ledger for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "ledger: finance read" on public.credit_ledger for select to authenticated
  using (private.has_role('finance'));
-- INSERT / UPDATE / DELETE: none. Users can never mint credits; corrections are new 'adjustment' rows.

create or replace function public.spark_balance()
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::int
  from public.credit_ledger
  where user_id = (select auth.uid())
    and (expires_at is null or expires_at > now());
$$;

-- ── daily_usage (free-tier metering) ────────────────────────────────────
create table public.daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  messages_used int not null default 0 check (messages_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create trigger set_updated_at before update on public.daily_usage
  for each row execute function extensions.moddatetime(updated_at);
alter table public.daily_usage enable row level security;
create policy "usage: read own" on public.daily_usage for select to authenticated
  using ((select auth.uid()) = user_id);
-- INSERT / UPDATE / DELETE: none (server increments atomically).

-- ── reports ─────────────────────────────────────────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_type public.report_target not null,
  target_id text not null,
  reason text not null check (char_length(reason) between 2 and 60),
  details text check (char_length(details) <= 2000),
  status public.report_status not null default 'open',
  reviewer_id uuid references auth.users (id) on delete set null,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.reports
  for each row execute function extensions.moddatetime(updated_at);
create index idx_reports_reporter on public.reports (reporter_id); -- FK + "my reports"
create index idx_reports_queue on public.reports (status, created_at); -- moderation queue
create index idx_reports_reviewer on public.reports (reviewer_id); -- FK

alter table public.reports enable row level security;
create policy "reports: file own" on public.reports for insert to authenticated
  with check ((select auth.uid()) = reporter_id and status = 'open' and reviewer_id is null and resolution is null);
create policy "reports: read own" on public.reports for select to authenticated
  using ((select auth.uid()) = reporter_id);
create policy "reports: moderators read" on public.reports for select to authenticated
  using (private.has_role('moderator'));
create policy "reports: moderators resolve" on public.reports for update to authenticated
  using (private.has_role('moderator')) with check (private.has_role('moderator'));
-- DELETE: none. Reports are kept for the audit trail.

-- ── admin_roles policies & audit_logs ───────────────────────────────────
alter table public.admin_roles enable row level security;
create policy "roles: staff read own" on public.admin_roles for select to authenticated
  using ((select auth.uid()) = user_id or private.has_role('super_admin'));
create policy "roles: super admin grant" on public.admin_roles for insert to authenticated
  with check (private.has_role('super_admin'));
create policy "roles: super admin change" on public.admin_roles for update to authenticated
  using (private.has_role('super_admin')) with check (private.has_role('super_admin'));
create policy "roles: super admin revoke" on public.admin_roles for delete to authenticated
  using (private.has_role('super_admin'));

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_audit_actor_time on public.audit_logs (actor_id, created_at desc); -- FK + per-admin trail
alter table public.audit_logs enable row level security;
create policy "audit: super admin read" on public.audit_logs for select to authenticated
  using (private.has_role('super_admin'));
-- INSERT / UPDATE / DELETE: none for clients. Written by the server; immutable.
