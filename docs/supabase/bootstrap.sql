-- CorrectionFIELD Supabase bootstrap (development-friendly)
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- =====================================================
-- Core tables
-- =====================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'viewer' check (role in ('owner','admin','supervisor','corrector','editor','viewer')),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  bbox jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','admin','supervisor','corrector','editor','viewer')),
  assigned_zone jsonb,
  joined_at timestamptz not null default now(),
  unique(project_id, user_id)
);

create table if not exists public.layers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  geometry_type text not null,
  source_crs text not null default 'EPSG:4326',
  is_reference boolean not null default false,
  is_editable boolean not null default true,
  display_order integer not null default 0,
  group_name text,
  visible boolean not null default true,
  fields jsonb not null default '[]'::jsonb,
  style jsonb not null default '{"mode":"simple"}'::jsonb,
  form_config jsonb not null default '{}'::jsonb,
  min_zoom integer not null default 0,
  max_zoom integer not null default 22,
  created_at timestamptz not null default now()
);

create table if not exists public.features (
  id uuid primary key default gen_random_uuid(),
  layer_id uuid not null references public.layers(id) on delete cascade,
  geom jsonb,
  props jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('draft','pending','locked','corrected','validated','rejected')),
  locked_by uuid references public.profiles(id) on delete set null,
  locked_at timestamptz,
  lock_expires timestamptz,
  corrected_by uuid references public.profiles(id) on delete set null,
  corrected_at timestamptz,
  validated_by uuid references public.profiles(id) on delete set null,
  validated_at timestamptz,
  source_file text,
  dirty boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.corrections (
  id uuid primary key default gen_random_uuid(),
  feature_id uuid not null references public.features(id) on delete cascade,
  layer_id uuid not null references public.layers(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  device_id text,
  props_patch jsonb,
  geom_corrected jsonb,
  kobo_submission_id text,
  kobo_form_id text,
  enketo_submission jsonb,
  notes text,
  gps_point jsonb,
  gps_accuracy double precision,
  media_urls text[] not null default '{}'::text[],
  status text not null default 'submitted' check (status in ('pending','submitted','validated','rejected')),
  conflict_of uuid references public.corrections(id) on delete set null,
  dirty boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- Indexes
-- =====================================================

create index if not exists idx_layers_project_id on public.layers(project_id);
create index if not exists idx_features_layer_id on public.features(layer_id);
create index if not exists idx_features_status on public.features(status);
create index if not exists idx_corrections_feature_id on public.corrections(feature_id);
create index if not exists idx_corrections_layer_id on public.corrections(layer_id);
create index if not exists idx_project_members_project_id on public.project_members(project_id);
create index if not exists idx_project_members_user_id on public.project_members(user_id);

-- =====================================================
-- Timestamps
-- =====================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists trg_features_updated_at on public.features;
create trigger trg_features_updated_at
before update on public.features
for each row execute function public.set_updated_at();

drop trigger if exists trg_corrections_updated_at on public.corrections;
create trigger trg_corrections_updated_at
before update on public.corrections
for each row execute function public.set_updated_at();

-- =====================================================
-- Auth profile sync
-- =====================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =====================================================
-- RPCs used by the app
-- =====================================================

-- Note: bbox argument is accepted for compatibility; for now this returns by layer ids.
create or replace function public.features_in_viewport(
  p_layer_ids uuid[],
  p_bbox text
)
returns setof public.features
language sql
stable
as $$
  select f.*
  from public.features f
  where f.layer_id = any(p_layer_ids);
$$;

create or replace function public.lock_feature(
  p_feature_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_row public.features;
begin
  select * into v_row from public.features where id = p_feature_id for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;

  if v_row.locked_by is not null
     and v_row.locked_by <> p_user_id
     and (v_row.lock_expires is null or v_row.lock_expires > now()) then
    return jsonb_build_object('success', false, 'reason', 'already_locked');
  end if;

  update public.features
  set
    locked_by = p_user_id,
    locked_at = now(),
    lock_expires = now() + interval '15 minutes',
    status = 'locked'
  where id = p_feature_id;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.unlock_feature(
  p_feature_id uuid
)
returns void
language sql
as $$
  update public.features
  set
    locked_by = null,
    locked_at = null,
    lock_expires = null,
    status = case when status = 'locked' then 'pending' else status end
  where id = p_feature_id;
$$;

create or replace function public.stats_by_layer(
  p_layer_id uuid
)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
  from (
    select c.status, count(*)::int as cnt
    from public.corrections c
    where c.layer_id = p_layer_id
    group by c.status
  ) s;
$$;

-- =====================================================
-- Development policies (open access)
-- IMPORTANT: keep for local/dev only.
-- =====================================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.layers enable row level security;
alter table public.features enable row level security;
alter table public.corrections enable row level security;

drop policy if exists "dev_all_profiles" on public.profiles;
create policy "dev_all_profiles" on public.profiles
for all to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev_all_projects" on public.projects;
create policy "dev_all_projects" on public.projects
for all to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev_all_project_members" on public.project_members;
create policy "dev_all_project_members" on public.project_members
for all to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev_all_layers" on public.layers;
create policy "dev_all_layers" on public.layers
for all to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev_all_features" on public.features;
create policy "dev_all_features" on public.features
for all to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev_all_corrections" on public.corrections;
create policy "dev_all_corrections" on public.corrections
for all to anon, authenticated
using (true)
with check (true);

-- =====================================================
-- Quick seed (safe to run once)
-- =====================================================

do $$
declare
  v_owner uuid;
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
