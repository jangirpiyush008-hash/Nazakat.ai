-- Cross-user RLS check. Runs in a transaction and ROLLS BACK; nothing persists.
-- Run with: psql "$DATABASE_URL" -f supabase/tests/rls_cross_user.sql
-- Expected: every "B sees …" = 0, every "B can …" = blocked: 42501,
-- "B deleted A memories" = 0, "A sees own messages" = 1, "A balance" = 20.
begin;
create temp table results (test text, outcome text) on commit drop;
grant all on results to authenticated, anon;

insert into auth.users (id, instance_id, aud, role, email) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@test.local'),
 ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@test.local');
insert into public.conversations (id, user_id, companion_id)
 select 'aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', id from public.companions where slug='meera';
insert into public.messages (conversation_id, user_id, role, content)
 values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','user','secret from A');
insert into public.memory_items (user_id, companion_id, fact)
 select '11111111-1111-1111-1111-111111111111', id, 'A likes cutting chai' from public.companions where slug='meera';
insert into public.credit_ledger (user_id, kind, bucket, amount, idempotency_key)
 values ('11111111-1111-1111-1111-111111111111','grant','promo',20,'test-grant-a');
insert into results values ('profile auto-created', (select count(*)::text from public.profiles where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222')));

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into results values ('B sees A conversations', (select count(*)::text from public.conversations));
insert into results values ('B sees A messages', (select count(*)::text from public.messages));
insert into results values ('B sees A memories', (select count(*)::text from public.memory_items));
insert into results values ('B sees A ledger', (select count(*)::text from public.credit_ledger));
insert into results values ('B sees other profiles', (select count(*)::text from public.profiles where id <> '22222222-2222-2222-2222-222222222222'));
insert into results values ('B sees personas', (select count(*)::text from public.companion_personas));
insert into results values ('B balance', public.spark_balance()::text);
do $$ begin
  insert into public.credit_ledger (user_id, kind, bucket, amount, idempotency_key) values ('22222222-2222-2222-2222-222222222222','grant','promo',1000,'self-mint');
  insert into results values ('B can mint Sparks', 'YES - BAD');
exception when others then insert into results values ('B can mint Sparks', 'blocked: ' || sqlstate); end $$;
do $$ begin
  insert into public.messages (conversation_id, user_id, role, content) values ('aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','assistant','fake');
  insert into results values ('B can insert messages', 'YES - BAD');
exception when others then insert into results values ('B can insert messages', 'blocked: ' || sqlstate); end $$;
do $$ begin
  update public.profiles set age_confirmed_at = now() where id = '22222222-2222-2222-2222-222222222222';
  insert into results values ('B can self-confirm age', 'YES - BAD');
exception when others then insert into results values ('B can self-confirm age', 'blocked: ' || sqlstate); end $$;
do $$ declare n int; begin
  delete from public.memory_items where fact = 'A likes cutting chai';
  get diagnostics n = row_count;
  insert into results values ('B deleted A memories', n::text); end $$;

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into results values ('A sees own messages', (select count(*)::text from public.messages));
insert into results values ('A balance', public.spark_balance()::text);
reset role;
select * from results;
rollback;
