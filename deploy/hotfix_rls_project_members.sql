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

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.owner_id = auth.uid()
  );
$$;

create or replace function public.can_manage_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_project_owner(p_project_id)
      or public.has_project_role(p_project_id, array['owner','admin']);
$$;

revoke all on function public.is_project_member(uuid) from public;
revoke all on function public.has_project_role(uuid, text[]) from public;
revoke all on function public.is_project_owner(uuid) from public;
revoke all on function public.can_manage_project(uuid) from public;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.has_project_role(uuid, text[]) to authenticated;
grant execute on function public.is_project_owner(uuid) to authenticated;
grant execute on function public.can_manage_project(uuid) to authenticated;

drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects
  for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_project_member(id)
  );

drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert" on public.projects
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "projects_update" on public.projects;
create policy "projects_update" on public.projects
  for update to authenticated
  using (public.can_manage_project(id))
  with check (public.can_manage_project(id));

drop policy if exists "members_select" on public.project_members;
create policy "members_select" on public.project_members
  for select to authenticated
  using (
    public.is_project_member(project_id)
    or public.is_project_owner(project_id)
  );

drop policy if exists "members_manage" on public.project_members;
create policy "members_manage" on public.project_members
  for all to authenticated
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));
