-- Deletes signups that never completed email verification, so a stream of
-- fake/dummy addresses doesn't sit in the database forever. Only ever
-- touches accounts with email_confirmed_at still null (Google sign-ins are
-- auto-confirmed and never match this, so they're never affected).
-- Safe to re-run.

create or replace function public.cleanup_unverified_users(older_than interval default '24 hours')
returns integer
language plpgsql security definer set search_path = public as $$
declare
  deleted_count integer;
begin
  with victims as (
    select id from auth.users
    where email_confirmed_at is null
      and created_at < now() - older_than
  )
  delete from auth.users where id in (select id from victims);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_unverified_users(interval) from public, anon, authenticated;
grant execute on function public.cleanup_unverified_users(interval) to service_role;

-- Optional: if your Supabase project has the pg_cron extension enabled
-- (Database -> Extensions -> pg_cron), uncomment and run this once to have
-- it run automatically every day instead of needing the admin panel button:
--
-- select cron.schedule(
--   'cleanup-unverified-users-daily',
--   '0 3 * * *',
--   $$ select public.cleanup_unverified_users('24 hours'); $$
-- );
