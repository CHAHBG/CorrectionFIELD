# Backend setup (Supabase) — CorrectionFIELD

This project expects a Supabase backend.

## Deployment paths

| Path | Guide | Cost |
|------|-------|------|
| **Google Cloud Free Tier** (recommended) | [docs/deploy-gcp-free.md](deploy-gcp-free.md) | FREE forever |
| Self-hosted on any VPS | [docs/self-hosted-backend-plan.md](self-hosted-backend-plan.md) | varies |
| Supabase Cloud (if you have quota) | This file (below) | FREE tier limited |

Production deployment files are in the [`deploy/`](../deploy/) folder:
- `docker-compose.yml` — full Supabase stack
- `bootstrap.sql` — v2 schema with PostGIS + RLS
- `.env.example` — environment template
- `Caddyfile` — HTTPS reverse proxy

## 1) Create a Supabase project

1. Go to Supabase and create a new project.
2. Open **Project Settings → API** and copy:
   - `Project URL`
   - `anon public key`

## 2) Bootstrap database schema

1. Open **SQL Editor** in Supabase.
2. Paste and run the SQL from [docs/supabase/bootstrap.sql](docs/supabase/bootstrap.sql).

This creates all required tables and RPCs used by the app:
- `profiles`, `projects`, `project_members`, `layers`, `features`, `corrections`
- `features_in_viewport`, `lock_feature`, `unlock_feature`, `stats_by_layer`

It also adds a dev-friendly profile trigger (`auth.users` → `profiles`) and permissive dev RLS policies.

## 3) Create your first auth user

You can do either:
- Supabase Dashboard → **Authentication → Users → Add user**, or
- sign up through client code once signup is added.

After creating at least one user, rerun the seed block at the end of [docs/supabase/bootstrap.sql](docs/supabase/bootstrap.sql) if needed; it creates `procasef-demo` project and assigns the first user as owner.

## 4) Wire the web app

Create `web/.env.local` with:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_REAL_ANON_KEY
```

Then run:

```bash
cd web
npm run dev
```

## 5) Wire the mobile app

Edit [mobile/src/infra/supabase.ts](mobile/src/infra/supabase.ts):
- replace `SUPABASE_URL`
- replace `SUPABASE_ANON_KEY`

Then run mobile app normally.

## 6) Quick verification

In Supabase SQL Editor, run:

```sql
select count(*) from public.profiles;
select count(*) from public.projects;
select count(*) from public.layers;
```

In app behavior:
- login should succeed for created user
- profile should load from `profiles`
- web/admin API calls should no longer fail with missing table/RPC errors

## Notes

- The default policy setup here is intentionally open for development speed.
- Before production, replace with strict RLS policies by project membership and role.
