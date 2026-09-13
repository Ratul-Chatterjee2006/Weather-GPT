-- Adds: alert geolocation + expiry (for the map), chat_logs (for admin
-- analytics), and broadcasts (for the site-wide banner). Safe to re-run.

-- ---------------------------------------------------------- alerts: map + expiry
alter table public.alerts add column if not exists latitude double precision;
alter table public.alerts add column if not exists longitude double precision;
alter table public.alerts add column if not exists radius_km numeric not null default 50;
alter table public.alerts add column if not exists expires_at timestamptz;
-- No RLS/policy change needed — alerts already has public read (active = true)
-- and admin-manage policies from the earlier migration.

-- ------------------------------------------------------------------ chat_logs
create table if not exists public.chat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  location text,
  language text,
  category text not null default 'other', -- 'forecast' | 'risk_warning' | 'other'
  created_at timestamptz not null default now()
);
-- Written by the server using the service-role key (bypasses RLS), never by
-- the browser directly, so no insert grant for anon/authenticated here.
grant select on public.chat_logs to authenticated;
grant all on public.chat_logs to service_role;
alter table public.chat_logs enable row level security;

drop policy if exists chat_logs_admin_read on public.chat_logs;
create policy chat_logs_admin_read on public.chat_logs for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------------------ broadcasts
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.broadcasts to anon;
grant select, insert, update, delete on public.broadcasts to authenticated;
grant all on public.broadcasts to service_role;
alter table public.broadcasts enable row level security;

drop policy if exists broadcasts_public_read on public.broadcasts;
create policy broadcasts_public_read on public.broadcasts for select to anon, authenticated
  using (active = true);
drop policy if exists broadcasts_admin_all on public.broadcasts;
create policy broadcasts_admin_all on public.broadcasts for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
