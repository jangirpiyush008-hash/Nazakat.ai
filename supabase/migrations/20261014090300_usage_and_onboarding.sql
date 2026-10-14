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
