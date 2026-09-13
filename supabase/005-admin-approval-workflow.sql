-- Adds a request/approval workflow for demoting admins and deactivating
-- users, plus a "director" tier so the owner can hand near-equal authority
-- to trusted admins. Directors still can never touch the owner's account
-- (enforced separately in 004-protect-admin.sql), and can't act directly on
-- each other — only through a request that only the owner may review.
-- Safe to re-run.

create table if not exists public.admin_directors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now()
);
alter table public.admin_directors enable row level security;
-- Readable by any admin (so the panel can show director badges); writes are
-- never granted to authenticated — only the server function (service-role
-- key) can write here, and it independently re-checks the caller is the
-- protected owner email before doing so.
grant select on public.admin_directors to authenticated;
grant all on public.admin_directors to service_role;

drop policy if exists admin_directors_read on public.admin_directors;
create policy admin_directors_read on public.admin_directors for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Used only by the RLS policy below (defense in depth — the app's own admin
-- removal logic all runs server-side with the service-role key regardless).
create or replace function public.is_admin_authority(_user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.users u where u.id = _user_id and lower(u.email) = 'ratulc686@gmail.com')
      or exists (select 1 from public.admin_directors where user_id = _user_id);
$$;
revoke all on function public.is_admin_authority(uuid) from public, anon;
grant execute on function public.is_admin_authority(uuid) to authenticated, service_role;

drop policy if exists user_roles_admin_delete on public.user_roles;
create policy user_roles_admin_delete on public.user_roles for delete to authenticated
  using (public.is_admin_authority(auth.uid()));

create table if not exists public.admin_requests (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('remove_admin', 'deactivate_user')),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert on public.admin_requests to authenticated;
grant all on public.admin_requests to service_role;
alter table public.admin_requests enable row level security;

drop policy if exists admin_requests_select on public.admin_requests;
create policy admin_requests_select on public.admin_requests for select to authenticated
  using (requested_by = auth.uid() or public.is_admin_authority(auth.uid()));

drop policy if exists admin_requests_insert on public.admin_requests;
create policy admin_requests_insert on public.admin_requests for insert to authenticated
  with check (requested_by = auth.uid() and public.has_role(auth.uid(), 'admin'));
-- No update/delete grant for authenticated — approving/rejecting goes
-- through the server function (service-role key), which re-checks who may
-- review what (e.g. only the owner may review a request about a director).
