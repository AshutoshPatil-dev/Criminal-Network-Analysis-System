-- Nexus — production-oriented RLS hardening
-- Run this AFTER supabase/schema.sql (paste into the Supabase SQL editor).
-- It replaces the demo-permissive case-data policies with authenticated-only,
-- ownership-scoped rules. The service role and the SQL editor are unaffected;
-- client code only ever holds the anon key, so after this file anon visitors
-- can no longer read or write any case data — signing in is required.

-- 1) Officers roster function grants: authenticated only (anon can't call).
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- 2) Helper: officer name of the signed-in user, for ownership checks.
create or replace function public.current_user_name()
returns text language sql stable security definer set search_path = public as
$$ select name from public.profiles where id = auth.uid() $$;

grant execute on function public.current_user_name() to authenticated;

-- 3) Case graph: any signed-in officer can read; clients cannot write.
drop policy if exists "demo read entities" on public.entities;
drop policy if exists "demo read relationships" on public.relationships;
drop policy if exists "demo read crime_events" on public.crime_events;

create policy "read entities authenticated" on public.entities
  for select to authenticated using (true);
create policy "read relationships authenticated" on public.relationships
  for select to authenticated using (true);
create policy "read crime_events authenticated" on public.crime_events
  for select to authenticated using (true);

-- 4) Reports: read/create for all signed-in officers; edit/delete only by the
--    author or an admin.
drop policy if exists "demo write reports" on public.reports;

create policy "read reports authenticated" on public.reports
  for select to authenticated using (true);
create policy "insert reports authenticated" on public.reports
  for insert to authenticated with check (true);
create policy "update reports owner or admin" on public.reports
  for update to authenticated
  using (submitted_by = public.current_user_name() or public.is_admin())
  with check (submitted_by = public.current_user_name() or public.is_admin());
create policy "delete reports owner or admin" on public.reports
  for delete to authenticated
  using (submitted_by = public.current_user_name() or public.is_admin());

-- 5) Detail-change history: append-only for signed-in officers.
drop policy if exists "demo write detail_history" on public.report_detail_history;

create policy "read detail_history authenticated" on public.report_detail_history
  for select to authenticated using (true);
create policy "insert detail_history authenticated" on public.report_detail_history
  for insert to authenticated with check (true);

-- 6) Audit trail: append-only; readable by signed-in officers.
drop policy if exists "demo insert audit_logs" on public.audit_logs;
drop policy if exists "demo read audit_logs" on public.audit_logs;

create policy "insert audit_logs authenticated" on public.audit_logs
  for insert to authenticated with check (true);
create policy "read audit_logs authenticated" on public.audit_logs
  for select to authenticated using (true);

-- 7) FIR documents: same posture as reports (ownership ties to created_by).
drop policy if exists "demo write fir_documents" on public.fir_documents;
drop policy if exists "demo read fir_documents" on public.fir_documents;

create policy "read fir_documents authenticated" on public.fir_documents
  for select to authenticated using (true);
create policy "insert fir_documents authenticated" on public.fir_documents
  for insert to authenticated with check (true);
create policy "update fir_documents owner or admin" on public.fir_documents
  for update to authenticated
  using (created_by = public.current_user_name() or public.is_admin())
  with check (created_by = public.current_user_name() or public.is_admin());
create policy "delete fir_documents owner or admin" on public.fir_documents
  for delete to authenticated
  using (created_by = public.current_user_name() or public.is_admin());

-- 8) Storage: authenticated uploads/reads; owners manage their own objects.
drop policy if exists "demo upload case-files" on storage.objects;
drop policy if exists "demo read case-files" on storage.objects;

create policy "upload case-files authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'case-files');
create policy "read case-files authenticated" on storage.objects
  for select to authenticated
  using (bucket_id = 'case-files');
create policy "update case-files owner" on storage.objects
  for update to authenticated
  using (bucket_id = 'case-files' and owner_id = auth.uid())
  with check (bucket_id = 'case-files' and owner_id = auth.uid());
create policy "delete case-files owner" on storage.objects
  for delete to authenticated
  using (bucket_id = 'case-files' and owner_id = auth.uid());

-- NOTES
-- * The frontend re-fetches case data after sign-in, so the authenticated-role
--   policies show data once an officer logs in (no app change needed).
-- * Re-run supabase/seed_data.sql from the SQL editor if you seeded before
--   hardening — client-side anon inserts never worked (no write policy).
-- * For real deployments also enable "Confirm email" in Auth > Settings and
--   set a strong JWT expiry; keep the service_role key server-side only.