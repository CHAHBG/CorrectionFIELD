-- =============================================================
--  CorrectionFIELD Platform v2 — Bootstrap SQL
--  Target: Supabase self-hosted (PostgreSQL 15 + PostGIS 3.4)
--  Run in SQL Editor after 'docker compose up'
-- =============================================================

-- ── Extensions ─────────────────────────────────────
create extension if not exists pgcrypto;
create extension if not exists postgis;

-- =====================================================
-- 1. Core tables
-- =====================================================

-- Profiles (synced from auth.users via trigger)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text unique,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Projects
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  owner_id    uuid references public.profiles(id) on delete set null,
  bbox        geometry(Polygon, 4326),
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Project members (multi-user, role-based, optional zone)
create table if not exists public.project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'viewer'
             check (role in ('owner','admin','supervisor','corrector','editor','viewer')),
  zone       geometry(Polygon, 4326),
  joined_at  timestamptz not null default now(),
  unique(project_id, user_id)
);

-- Layers (dynamic schema via fields JSONB)
create table if not exists public.layers (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  name           text not null,
  description    text,
  geometry_type  text not null,
  source_crs     text not null default 'EPSG:4326',
  is_reference   boolean not null default false,
  is_editable    boolean not null default true,
  display_order  integer not null default 0,
  group_name     text,
  visible        boolean not null default true,
  fields         jsonb not null default '[]'::jsonb,
  style          jsonb not null default '{"mode":"simple"}'::jsonb,
  form_config    jsonb not null default '{}'::jsonb,
  filter_fields  jsonb not null default '[]'::jsonb,
  min_zoom       integer not null default 0,
  max_zoom       integer not null default 22,
  created_at     timestamptz not null default now()
);

-- Features (geospatial entities, dynamic attributes in JSONB)
create table if not exists public.features (
  id             uuid primary key default gen_random_uuid(),
  layer_id       uuid not null references public.layers(id) on delete cascade,
  geom           geometry(Geometry, 4326) not null,
  props          jsonb not null default '{}'::jsonb,
  status         text not null default 'pending'
                 check (status in ('draft','pending','locked','corrected','validated','rejected')),
  locked_by      uuid references public.profiles(id) on delete set null,
  locked_at      timestamptz,
  lock_expires   timestamptz,
  corrected_by   uuid references public.profiles(id) on delete set null,
  corrected_at   timestamptz,
  validated_by   uuid references public.profiles(id) on delete set null,
  validated_at   timestamptz,
  source_file    text,
  dirty          boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Corrections (diff: original vs corrected)
create table if not exists public.corrections (
  id                  uuid primary key default gen_random_uuid(),
  feature_id          uuid not null references public.features(id) on delete cascade,
  layer_id            uuid not null references public.layers(id) on delete cascade,
  user_id             uuid references public.profiles(id) on delete set null,
  device_id           text,
  props_patch         jsonb,
  geom_corrected      geometry(Geometry, 4326),
  kobo_submission_id  text,
  kobo_form_id        text,
  enketo_submission   jsonb,
  notes               text,
  gps_point           geometry(Point, 4326),
  gps_accuracy        real,
  media_urls          jsonb not null default '[]'::jsonb,
  status              text not null default 'submitted'
                      check (status in ('pending','submitted','validated','rejected')),
  conflict_of         uuid references public.corrections(id) on delete set null,
  dirty               boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- =====================================================
-- 2. Indexes
-- =====================================================

-- Spatial
create index if not exists idx_features_geom      on public.features using gist(geom);
create index if not exists idx_corrections_geom    on public.corrections using gist(geom_corrected);
create index if not exists idx_corrections_gps     on public.corrections using gist(gps_point);
create index if not exists idx_projects_bbox       on public.projects using gist(bbox);
create index if not exists idx_members_zone        on public.project_members using gist(zone);

-- B-tree
create index if not exists idx_features_layer_id   on public.features(layer_id);
create index if not exists idx_features_status      on public.features(status);
create index if not exists idx_corrections_feat     on public.corrections(feature_id);
create index if not exists idx_corrections_layer    on public.corrections(layer_id);
create index if not exists idx_layers_project       on public.layers(project_id);
create index if not exists idx_members_project      on public.project_members(project_id);
create index if not exists idx_members_user         on public.project_members(user_id);

-- GIN on JSONB attributes for dynamic queries
create index if not exists idx_features_props       on public.features using gin(props);

-- =====================================================
-- 3. Views
-- =====================================================

-- Feature with latest correction merged
create or replace view public.features_corrected as
select
  f.id,
  f.layer_id,
  f.props || coalesce(c.props_patch, '{}'::jsonb) as props_merged,
  coalesce(c.geom_corrected, f.geom)              as geom_final,
  f.status,
  f.locked_by,
  f.corrected_by,
  f.corrected_at,
  f.validated_by,
  f.validated_at,
  f.source_file,
  f.created_at,
  f.updated_at
from public.features f
left join lateral (
  select * from public.corrections
  where feature_id = f.id
  order by created_at desc
  limit 1
) c on true;

-- =====================================================
-- 4. Trigger: auto-update timestamps
-- =====================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_projects_ts on public.projects;
create trigger trg_projects_ts
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists trg_features_ts on public.features;
create trigger trg_features_ts
before update on public.features
for each row execute function public.set_updated_at();

drop trigger if exists trg_corrections_ts on public.corrections;
create trigger trg_corrections_ts
before update on public.corrections
for each row execute function public.set_updated_at();

-- =====================================================
-- 5. Trigger: auto-create profile on signup
-- =====================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql
security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =====================================================
-- 6. RPCs
-- =====================================================

-- Lock a feature (soft lock, 30 min TTL)
create or replace function public.lock_feature(
  p_feature_id uuid,
  p_user_id    uuid
) returns jsonb language plpgsql security definer as $$
declare
  v_row public.features;
begin
  select * into v_row from public.features where id = p_feature_id for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;

  if v_row.locked_by is not null
     and v_row.locked_by <> p_user_id
     and (v_row.lock_expires is null or v_row.lock_expires > now())
  then
    return jsonb_build_object('success', false, 'reason', 'already_locked', 'locked_by', v_row.locked_by);
  end if;

  update public.features set
    status       = 'locked',
    locked_by    = p_user_id,
    locked_at    = now(),
    lock_expires = now() + interval '30 minutes',
    updated_at   = now()
  where id = p_feature_id;

  return jsonb_build_object('success', true);
end;
$$;

-- Unlock a feature
create or replace function public.unlock_feature(
  p_feature_id uuid
) returns void language sql security definer as $$
  update public.features set
    locked_by    = null,
    locked_at    = null,
    lock_expires = null,
    status       = case when status = 'locked' then 'pending' else status end
  where id = p_feature_id;
$$;

-- Expire stale locks (call via pg_cron or app-side job)
create or replace function public.expire_stale_locks()
returns integer language plpgsql security definer as $$
declare
  cnt integer;
begin
  update public.features set
    status       = 'pending',
    locked_by    = null,
    locked_at    = null,
    lock_expires = null
  where status = 'locked' and lock_expires < now();

  get diagnostics cnt = row_count;
  return cnt;
end;
$$;

-- Features in a viewport (PostGIS spatial query)
create or replace function public.features_in_viewport(
  p_layer_ids uuid[],
  p_min_lng   double precision,
  p_min_lat   double precision,
  p_max_lng   double precision,
  p_max_lat   double precision
) returns setof public.features language sql stable as $$
  select f.*
  from public.features f
  where f.layer_id = any(p_layer_ids)
    and f.geom && st_makeenvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326);
$$;

-- Correction stats by layer
create or replace function public.stats_by_layer(
  p_layer_id uuid
) returns jsonb language sql stable as $$
  select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
  from (
    select c.status, count(*)::int as cnt
    from public.corrections c
    where c.layer_id = p_layer_id
    group by c.status
  ) s;
$$;

-- =====================================================
-- 7. Row Level Security
-- =====================================================

alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.layers          enable row level security;
alter table public.features        enable row level security;
alter table public.corrections     enable row level security;

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

-- Profiles: users see all profiles, edit only their own
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update" on public.profiles
  for update to authenticated using (id = auth.uid());

-- Projects: members see their projects, owners/admins manage
create policy "projects_select" on public.projects
  for select to authenticated
  using (id in (select project_id from public.project_members where user_id = auth.uid()));

create policy "projects_insert" on public.projects
  for insert to authenticated with check (true);

create policy "projects_update" on public.projects
  for update to authenticated
  using (id in (
    select project_id from public.project_members
    where user_id = auth.uid() and role in ('owner','admin')
  ));

-- Project members: see members of your projects
create policy "members_select" on public.project_members
  for select to authenticated
  using (public.is_project_member(project_id));

create policy "members_manage" on public.project_members
  for all to authenticated
  using (public.has_project_role(project_id, array['owner','admin']))
  with check (public.has_project_role(project_id, array['owner','admin']));

-- Layers: visible to project members
create policy "layers_select" on public.layers
  for select to authenticated
  using (project_id in (select project_id from public.project_members where user_id = auth.uid()));

create policy "layers_manage" on public.layers
  for all to authenticated
  using (project_id in (
    select project_id from public.project_members
    where user_id = auth.uid() and role in ('owner','admin','editor')
  ));

-- Features: visible if layer's project member
create policy "features_select" on public.features
  for select to authenticated
  using (layer_id in (
    select l.id from public.layers l
    join public.project_members pm on pm.project_id = l.project_id
    where pm.user_id = auth.uid()
  ));

create policy "features_manage" on public.features
  for all to authenticated
  using (layer_id in (
    select l.id from public.layers l
    join public.project_members pm on pm.project_id = l.project_id
    where pm.user_id = auth.uid() and pm.role in ('owner','admin','editor','corrector')
  ));

-- Corrections: visible if feature's layer's project member
create policy "corrections_select" on public.corrections
  for select to authenticated
  using (layer_id in (
    select l.id from public.layers l
    join public.project_members pm on pm.project_id = l.project_id
    where pm.user_id = auth.uid()
  ));

create policy "corrections_insert" on public.corrections
  for insert to authenticated
  with check (layer_id in (
    select l.id from public.layers l
    join public.project_members pm on pm.project_id = l.project_id
    where pm.user_id = auth.uid() and pm.role in ('owner','admin','editor','corrector')
  ));

create policy "corrections_manage" on public.corrections
  for update to authenticated
  using (layer_id in (
    select l.id from public.layers l
    join public.project_members pm on pm.project_id = l.project_id
    where pm.user_id = auth.uid() and pm.role in ('owner','admin','supervisor')
  ));

-- =====================================================
-- 8. Enable Realtime for live sync
-- =====================================================

alter publication supabase_realtime add table public.features;
alter publication supabase_realtime add table public.corrections;

-- =====================================================
-- 9. Seed demo project (safe to rerun)
-- =====================================================

do $$
declare
  v_owner   uuid;
  v_project uuid;
begin
  select id into v_owner from public.profiles order by created_at asc limit 1;

  if v_owner is not null then
    insert into public.projects (slug, name, description, owner_id, settings)
    values (
      'procasef-demo',
      'PROCASEF Demo',
      'Projet de démarrage CorrectionFIELD',
      v_owner,
      '{"default_crs":"EPSG:4326","snap_tolerance":10,"auto_lock":true,"require_validation":true,"offline_enabled":true}'::jsonb
    )
    on conflict (slug) do nothing;

    select id into v_project from public.projects where slug = 'procasef-demo' limit 1;

    if v_project is not null then
      insert into public.project_members (project_id, user_id, role)
      values (v_project, v_owner, 'owner')
      on conflict (project_id, user_id) do nothing;
    end if;
  end if;
end $$;
