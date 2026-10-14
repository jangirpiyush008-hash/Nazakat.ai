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
