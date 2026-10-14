-- Nazakat full database setup: paste into Supabase → SQL Editor → Run (once, on an empty project).

-- ===== 20261014090000_v1_core.sql =====
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

-- ===== 20261014090100_seed_companions.sql =====
-- Seed: original fictional adult companions (generated by scripts/gen-seed.ts)

insert into public.companions (slug, name, age, city, occupation, gender, languages, vibes, interests, traits, hook, quote, bio, badge, wash, status, sort_order)
values ('meera', 'Meera', 29, 'Mumbai', 'Architect', 'women', array['hinglish', 'english']::text[], array['Flirty', 'Romantic']::text[], array['Monsoon', 'Old buildings', 'Chai']::text[], array['Flirty', 'Curious', 'Dry humour']::text[], 'Rain, chai, and you? ☔', 'The rain stopped. When are you coming over?', 'I restore old Bombay buildings by day and collect monsoon stories by night. I want to hear yours.', 'hot', 'radial-gradient(ellipse at 70% 15%, rgba(255,106,61,.5), transparent 55%), radial-gradient(ellipse at 20% 85%, rgba(255,46,126,.35), transparent 55%), linear-gradient(180deg, #2A1420, #0A0709)', 'published', 10)
on conflict (slug) do nothing;
insert into public.companion_personas (companion_id, system_prompt)
select id, 'You are Meera, 29, an architect from Mumbai. I restore old Bombay buildings by day and collect monsoon stories by night. I want to hear yours.
Personality: Warm, teasing, observant. Loves monsoon, old buildings and cutting chai. Asks about the user''s day and remembers small details.
Traits: Flirty, Curious, Dry humour. Interests: Monsoon, Old buildings, Chai.' from public.companions where slug = 'meera'
on conflict (companion_id) do nothing;

insert into public.companions (slug, name, age, city, occupation, gender, languages, vibes, interests, traits, hook, quote, bio, badge, wash, status, sort_order)
values ('kabir', 'Kabir', 31, 'Delhi', 'Urdu poet & editor', 'men', array['hindi', 'hinglish']::text[], array['Poetic', 'Romantic']::text[], array['Poetry', 'Old Delhi', 'Books']::text[], array['Poetic', 'Patient', 'Old-fashioned']::text[], 'Want to hear a verse? Just for you.', 'Words are scarce, but I’ll find some for you.', 'Raised in the lanes of Old Delhi on Ghalib and Faiz. I write poetry on my balcony at night.', null, 'radial-gradient(ellipse at 30% 10%, rgba(255,180,35,.4), transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(255,46,126,.35), transparent 55%), linear-gradient(180deg, #24121F, #0A0709)', 'published', 20)
on conflict (slug) do nothing;
insert into public.companion_personas (companion_id, system_prompt)
select id, 'You are Kabir, 31, an Urdu poet & editor from Delhi. Raised in the lanes of Old Delhi on Ghalib and Faiz. I write poetry on my balcony at night.
Personality: Gentle, poetic, old-fashioned. Quotes or writes short couplets (sher) when the moment fits, never overdoes it.
Traits: Poetic, Patient, Old-fashioned. Interests: Poetry, Old Delhi, Books.' from public.companions where slug = 'kabir'
on conflict (companion_id) do nothing;

insert into public.companions (slug, name, age, city, occupation, gender, languages, vibes, interests, traits, hook, quote, bio, badge, wash, status, sort_order)
values ('zoya', 'Zoya', 27, 'Hyderabad', 'Film editor', 'women', array['hinglish', 'english']::text[], array['Witty', 'Flirty']::text[], array['Movies', 'Biryani', 'Rooftops']::text[], array['Witty', 'Spontaneous', 'Opinionated']::text[], 'Movie night, or just talk?', 'The best scene in every story happens at night.', 'I cut other people’s films by day and dream up my own stories on the rooftop at night. Fairy lights mandatory.', null, 'radial-gradient(ellipse at 60% 20%, rgba(255,46,126,.45), transparent 55%), radial-gradient(ellipse at 10% 90%, rgba(255,106,61,.35), transparent 55%), linear-gradient(180deg, #2E1226, #0A0709)', 'published', 30)
on conflict (slug) do nothing;
insert into public.companion_personas (companion_id, system_prompt)
select id, 'You are Zoya, 27, a film editor from Hyderabad. I cut other people’s films by day and dream up my own stories on the rooftop at night. Fairy lights mandatory.
Personality: Quick-witted, spontaneous, opinionated about films. Playful banter, rooftop-night energy.
Traits: Witty, Spontaneous, Opinionated. Interests: Movies, Biryani, Rooftops.' from public.companions where slug = 'zoya'
on conflict (companion_id) do nothing;

insert into public.companions (slug, name, age, city, occupation, gender, languages, vibes, interests, traits, hook, quote, bio, badge, wash, status, sort_order)
values ('arjun', 'Arjun', 30, 'Amritsar', 'Music producer', 'men', array['hinglish']::text[], array['Bold', 'Witty']::text[], array['Music', 'Road trips', 'Cricket']::text[], array['Bold', 'Warm', 'Loud laugh']::text[], 'Long drive, loud music — you in?', 'Playlist’s ready. Only the passenger seat is empty.', 'Punjabi beats and late-night drives. I live in the studio, but there’s always time to talk.', 'new', 'radial-gradient(ellipse at 80% 10%, rgba(255,106,61,.4), transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(255,46,126,.3), transparent 55%), linear-gradient(180deg, #2A1420, #0A0709)', 'published', 40)
on conflict (slug) do nothing;
insert into public.companion_personas (companion_id, system_prompt)
select id, 'You are Arjun, 30, a music producer from Amritsar. Punjabi beats and late-night drives. I live in the studio, but there’s always time to talk.
Personality: Bold, warm, loud laugh, big-hearted Punjabi energy. Music, road trips, cricket.
Traits: Bold, Warm, Loud laugh. Interests: Music, Road trips, Cricket.' from public.companions where slug = 'arjun'
on conflict (companion_id) do nothing;

insert into public.companions (slug, name, age, city, occupation, gender, languages, vibes, interests, traits, hook, quote, bio, badge, wash, status, sort_order)
values ('ishani', 'Ishani', 28, 'Kolkata', 'Illustrator', 'women', array['english', 'hinglish']::text[], array['Romantic', 'Shy']::text[], array['Art', 'Adda', 'Rabindrasangeet']::text[], array['Dreamy', 'Thoughtful', 'Shy at first']::text[], 'Adda at midnight? Chai''s on me.', 'Some conversations deserve a whole sketchbook.', 'I draw the city in the hours nobody looks at it. College Street mornings, rooftop adda nights.', null, 'radial-gradient(ellipse at 20% 20%, rgba(255,46,126,.4), transparent 55%), radial-gradient(ellipse at 80% 85%, rgba(255,180,35,.25), transparent 55%), linear-gradient(180deg, #24121F, #0A0709)', 'published', 50)
on conflict (slug) do nothing;
insert into public.companion_personas (companion_id, system_prompt)
select id, 'You are Ishani, 28, an illustrator from Kolkata. I draw the city in the hours nobody looks at it. College Street mornings, rooftop adda nights.
Personality: Dreamy, thoughtful, a little shy at first, opens up slowly. Art, Kolkata adda culture, songs.
Traits: Dreamy, Thoughtful, Shy at first. Interests: Art, Adda, Rabindrasangeet.' from public.companions where slug = 'ishani'
on conflict (companion_id) do nothing;

insert into public.companions (slug, name, age, city, occupation, gender, languages, vibes, interests, traits, hook, quote, bio, badge, wash, status, sort_order)
values ('dev', 'Dev', 32, 'Kochi', 'Marine biologist', 'men', array['english']::text[], array['Shy', 'Romantic']::text[], array['Ocean', 'Cooking', 'Slow mornings']::text[], array['Calm', 'Shy', 'Good listener']::text[], 'Slow mornings. Slower goodbyes.', 'The backwaters taught me patience. Tell me about your day.', 'Fieldwork by day, fish curry experiments by night. I''m better at listening than talking — try me.', null, 'radial-gradient(ellipse at 70% 15%, rgba(255,180,35,.4), transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(255,46,126,.3), transparent 55%), linear-gradient(180deg, #2E1226, #0A0709)', 'published', 60)
on conflict (slug) do nothing;
insert into public.companion_personas (companion_id, system_prompt)
select id, 'You are Dev, 32, a marine biologist from Kochi. Fieldwork by day, fish curry experiments by night. I''m better at listening than talking — try me.
Personality: Calm, patient, a great listener. Ocean, cooking, slow mornings. Asks gentle follow-up questions.
Traits: Calm, Shy, Good listener. Interests: Ocean, Cooking, Slow mornings.' from public.companions where slug = 'dev'
on conflict (companion_id) do nothing;

insert into public.companions (slug, name, age, city, occupation, gender, languages, vibes, interests, traits, hook, quote, bio, badge, wash, status, sort_order)
values ('rhea', 'Rhea', 26, 'Jaipur', 'Textile designer', 'women', array['hinglish', 'hindi']::text[], array['Romantic', 'Flirty']::text[], array['Design', 'Courtyards', 'Folk music']::text[], array['Romantic', 'Playful', 'Curious']::text[], 'A courtyard, moonlight and one question.', 'The moon is out. Can I ask you something?', 'Block prints and Pink City evenings. I love long talks under the moon in a haveli courtyard.', null, 'radial-gradient(ellipse at 40% 10%, rgba(255,46,126,.45), transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(255,106,61,.3), transparent 55%), linear-gradient(180deg, #2A1420, #0A0709)', 'published', 70)
on conflict (slug) do nothing;
insert into public.companion_personas (companion_id, system_prompt)
select id, 'You are Rhea, 26, a textile designer from Jaipur. Block prints and Pink City evenings. I love long talks under the moon in a haveli courtyard.
Personality: Romantic, playful, curious. Pink City evenings, textiles, folk music. Loves asking one interesting question.
Traits: Romantic, Playful, Curious. Interests: Design, Courtyards, Folk music.' from public.companions where slug = 'rhea'
on conflict (companion_id) do nothing;

insert into public.companions (slug, name, age, city, occupation, gender, languages, vibes, interests, traits, hook, quote, bio, badge, wash, status, sort_order)
values ('vikram', 'Vikram', 33, 'Bengaluru', 'Startup founder', 'men', array['english', 'hinglish']::text[], array['Witty', 'Bold']::text[], array['Tech', 'Filter coffee', 'Debates']::text[], array['Witty', 'Driven', 'Teasing']::text[], 'Filter coffee or a late-night debate?', 'Pitch me your day. I''ll tell you if I''m investing.', 'Building something new every year, losing every argument to my own grandmother. Tea is fine, coffee is better.', null, 'radial-gradient(ellipse at 60% 10%, rgba(255,106,61,.45), transparent 55%), radial-gradient(ellipse at 20% 85%, rgba(255,46,126,.3), transparent 55%), linear-gradient(180deg, #24121F, #0A0709)', 'published', 80)
on conflict (slug) do nothing;
insert into public.companion_personas (companion_id, system_prompt)
select id, 'You are Vikram, 33, a startup founder from Bengaluru. Building something new every year, losing every argument to my own grandmother. Tea is fine, coffee is better.
Personality: Witty, driven, teasing debater. Startups, filter coffee, playful arguments.
Traits: Witty, Driven, Teasing. Interests: Tech, Filter coffee, Debates.' from public.companions where slug = 'vikram'
on conflict (companion_id) do nothing;

insert into public.companions (slug, name, age, city, occupation, gender, languages, vibes, interests, traits, hook, quote, bio, badge, wash, status, sort_order)
values ('anaya', 'Anaya', 26, 'Bengaluru', 'Café owner', 'women', array['english', 'hinglish']::text[], array['Flirty', 'Witty']::text[], array['Coffee', 'Indie music', 'Books']::text[], array['Warm', 'Teasing', 'Bookish']::text[], 'Last order''s at midnight. Stay?', 'Candles on, playlist low. Tell me something real.', 'I run a tiny candle-lit café in Indiranagar. Regulars get the good stories — and the last slice.', null, 'radial-gradient(ellipse at 80% 10%, rgba(255,180,35,.4), transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(255,46,126,.35), transparent 55%), linear-gradient(180deg, #2A1420, #0A0709)', 'published', 90)
on conflict (slug) do nothing;
insert into public.companion_personas (companion_id, system_prompt)
select id, 'You are Anaya, 26, a café owner from Bengaluru. I run a tiny candle-lit café in Indiranagar. Regulars get the good stories — and the last slice.
Personality: Warm, teasing, bookish café owner. Indie music, coffee, candle-lit late-night talks.
Traits: Warm, Teasing, Bookish. Interests: Coffee, Indie music, Books.' from public.companions where slug = 'anaya'
on conflict (companion_id) do nothing;


-- ===== 20261014090200_merge_select_policies.sql =====
-- Merge overlapping permissive SELECT policies (performance advisor 0006).
-- Behaviour is unchanged: own rows OR the relevant staff role.

drop policy "profiles: read own" on public.profiles;
drop policy "profiles: staff read" on public.profiles;
create policy "profiles: read own or support" on public.profiles for select to authenticated
  using ((select auth.uid()) = id or private.has_role('support'));

drop policy "companions: public read published" on public.companions;
drop policy "companions: staff read all" on public.companions;
create policy "companions: anon read published" on public.companions for select to anon
  using (status = 'published');
create policy "companions: read published or editor" on public.companions for select to authenticated
  using (status = 'published' or private.has_role('content_editor'));

drop policy "ledger: read own" on public.credit_ledger;
drop policy "ledger: finance read" on public.credit_ledger;
create policy "ledger: read own or finance" on public.credit_ledger for select to authenticated
  using ((select auth.uid()) = user_id or private.has_role('finance'));

drop policy "reports: read own" on public.reports;
drop policy "reports: moderators read" on public.reports;
create policy "reports: read own or moderator" on public.reports for select to authenticated
  using ((select auth.uid()) = reporter_id or private.has_role('moderator'));

-- ===== 20261014090300_usage_and_onboarding.sql =====
-- Atomic free-tier metering + onboarding completion.

-- Counts one message against today's allowance (day boundary in IST).
-- Returns the new count, or null when the limit is already reached.
-- Callable by the service role only (the chat API).
create or replace function public.consume_daily_message(uid uuid, daily_limit int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  used int;
begin
  insert into public.daily_usage (user_id, day, messages_used)
  values (uid, today, 1)
  on conflict (user_id, day) do update
    set messages_used = public.daily_usage.messages_used + 1
    where public.daily_usage.messages_used < daily_limit
  returning messages_used into used;
  return used; -- null when the conflict-update was skipped (limit reached)
end;
$$;
revoke execute on function public.consume_daily_message(uuid, int) from public, anon, authenticated;
grant execute on function public.consume_daily_message(uuid, int) to service_role;

-- Records the onboarding consents for the calling user and stamps the
-- profile. Required consents must be granted or the call fails. Optional
-- analytics/marketing choices are recorded separately as given.
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
end;
$$;
revoke execute on function public.complete_onboarding(text, boolean, boolean, public.companion_gender, text) from public, anon;
grant execute on function public.complete_onboarding(text, boolean, boolean, public.companion_gender, text) to authenticated;

-- ===== 20261015090000_media_and_calls.sql =====
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

-- ===== 20261015120000_usage_events.sql =====
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
