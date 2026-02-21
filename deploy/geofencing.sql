-- =============================================================
--  CorrectionFIELD — Geofencing helpers
--  Adds server-side zone enforcement for correctors
-- =============================================================

-- Function: check if a feature is inside the user's assigned zone.
-- Returns TRUE when:
--   • the user has no zone assigned (no restriction), OR
--   • the feature intersects the user's zone polygon.
create or replace function public.is_feature_in_user_zone(
  p_feature_geom geometry,
  p_project_id   uuid
) returns boolean
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
      and (pm.zone is null or st_intersects(pm.zone, p_feature_geom))
  );
$$;

-- Function: get the current user's zone polygon for a project (nullable).
create or replace function public.get_user_zone(
  p_project_id uuid
) returns geometry
language sql
stable
security definer
set search_path = public
as $$
  select pm.zone
  from public.project_members pm
  where pm.project_id = p_project_id
    and pm.user_id = auth.uid()
  limit 1;
$$;

-- Function: get all member zones for a project (admin view).
create or replace function public.get_project_zones(
  p_project_id uuid
) returns table (
  user_id   uuid,
  full_name text,
  role      text,
  zone      geometry
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pm.user_id,
    p.full_name,
    pm.role,
    pm.zone
  from public.project_members pm
  join public.profiles p on p.id = pm.user_id
  where pm.project_id = p_project_id
    and pm.zone is not null;
$$;

-- Grants
revoke all on function public.is_feature_in_user_zone(geometry, uuid) from public;
grant execute on function public.is_feature_in_user_zone(geometry, uuid) to authenticated;

revoke all on function public.get_user_zone(uuid) from public;
grant execute on function public.get_user_zone(uuid) to authenticated;

revoke all on function public.get_project_zones(uuid) from public;
grant execute on function public.get_project_zones(uuid) to authenticated;
