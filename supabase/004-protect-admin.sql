-- Makes it impossible to remove admin access, or deactivate/ban the account,
-- for one specific admin — no matter how it's attempted (the admin panel
-- already disables both buttons, but these triggers are the real
-- enforcement — they fire for every caller, including direct SQL or the
-- admin API). Safe to re-run.

create or replace function public.protect_admin_role() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  protected_id uuid;
begin
  select id into protected_id from auth.users where lower(email) = 'ratulc686@gmail.com';
  if protected_id is null then
    return coalesce(new, old);
  end if;

  if (tg_op = 'DELETE') then
    if old.user_id = protected_id and old.role = 'admin' then
      raise exception 'This account''s admin access is protected and cannot be removed.';
    end if;
    return old;
  end if;

  if (tg_op = 'UPDATE') then
    if old.user_id = protected_id and old.role = 'admin' and new.role <> 'admin' then
      raise exception 'This account''s admin access is protected and cannot be removed.';
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_admin_role_trigger on public.user_roles;
create trigger protect_admin_role_trigger
  before update or delete on public.user_roles
  for each row execute function public.protect_admin_role();

-- Same idea, but for deactivation: Supabase's admin-ban flag lives on
-- auth.users.banned_until, so block it being set for the protected account
-- no matter which client (app, script, or admin API) tries it.
create or replace function public.protect_admin_ban() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(old.email) = 'ratulc686@gmail.com'
     and new.banned_until is not null
     and new.banned_until > now() then
    raise exception 'This account is protected and cannot be deactivated.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_admin_ban_trigger on auth.users;
create trigger protect_admin_ban_trigger
  before update on auth.users
  for each row execute function public.protect_admin_ban();
