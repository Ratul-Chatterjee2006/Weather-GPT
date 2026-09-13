-- Lets existing admins promote/demote other users to admin from the panel.
-- Safe to re-run.

grant insert, delete on public.user_roles to authenticated;

drop policy if exists user_roles_admin_insert on public.user_roles;
create policy user_roles_admin_insert on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists user_roles_admin_delete on public.user_roles;
create policy user_roles_admin_delete on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
