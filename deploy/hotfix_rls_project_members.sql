-- Hotfix: remove RLS recursion on public.project_members
-- Run with: docker exec -i deploy-db-1 psql -h 127.0.0.1 -U supabase_admin -d postgres < deploy/hotfix_rls_project_members.sql

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
  );
$$;

create or replace function public.has_project_role(p_project_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.role = any(p_roles)
  );
$$;

revoke all on function public.is_project_member(uuid) from public;
revoke all on function public.has_project_role(uuid, text[]) from public;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.has_project_role(uuid, text[]) to authenticated;

drop policy if exists "members_select" on public.project_members;
create policy "members_select" on public.project_members
  for select to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "members_manage" on public.project_members;
create policy "members_manage" on public.project_members
  for all to authenticated
  using (public.has_project_role(project_id, array['owner','admin']))
  with check (public.has_project_role(project_id, array['owner','admin']));
