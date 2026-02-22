-- =============================================================
--  CorrectionFIELD SaaS — Multi-Tenant Upgrade
--  Run this script manually in Supabase Studio SQL Editor
--  or via 'docker compose exec db psql'
-- =============================================================

BEGIN;

-- 1. Create the `organizations` table
CREATE TABLE IF NOT EXISTS public.organizations (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  billing_plan text not null default 'free' check (billing_plan in ('free', 'pro', 'enterprise')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Organization members (Admins vs Users)
CREATE TABLE IF NOT EXISTS public.org_members (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  role           text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at     timestamptz not null default now(),
  unique(org_id, user_id)
);

-- Trigger for organizations
CREATE TRIGGER trg_organizations_ts
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Modify `projects` table
-- Add org_id to group projects by tenant
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS org_id uuid references public.organizations(id) on delete cascade;

-- (Optional) If you have existing projects, we must assign them to a dummy org first before making it NOT NULL:
-- DO $$
-- DECLARE v_org uuid;
-- BEGIN
--   IF EXISTS (SELECT 1 FROM public.projects WHERE org_id IS NULL) THEN
--     INSERT INTO public.organizations (slug, name) VALUES ('default-org', 'Default Organization') RETURNING id INTO v_org;
--     UPDATE public.projects SET org_id = v_org WHERE org_id IS NULL;
--     INSERT INTO public.org_members (org_id, user_id, role)
--       SELECT v_org, owner_id, 'owner' FROM public.projects GROUP BY owner_id;
--   END IF;
-- END $$;

-- Enforce org_id is not null after data migration
-- ALTER TABLE public.projects ALTER COLUMN org_id SET NOT NULL;

-- 3. Row Level Security for Organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- Org Members policies
CREATE POLICY "org_members_select" ON public.org_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid())
  );

-- Organizations policies
CREATE POLICY "organizations_select" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid())
  );

-- Only org admins/owners can update the org
CREATE POLICY "organizations_update" ON public.organizations
  FOR UPDATE TO authenticated
  USING (
    id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- 4. Update Projects RLS to use org_members
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects
  FOR SELECT TO authenticated
  USING (
    -- You can see a project if you are an org member
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "projects_insert" ON public.projects;
CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    -- You can create a project if you are an admin/owner of the org
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

DROP POLICY IF EXISTS "projects_update" ON public.projects;
CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE TO authenticated
  USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Optional: Track the user's "currently active" organization in their profile
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS current_org_id uuid references public.organizations(id) on delete set null;

COMMIT;
