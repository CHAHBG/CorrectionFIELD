# Self-hosted backend plan (no paid DB service)

This is the recommended path for CorrectionFIELD if you want to avoid paid database vendors while supporting many users.

## Recommended stack

- Database: PostgreSQL 16 + PostGIS
- Backend platform: self-hosted Supabase stack (Auth + Realtime + API)
- Object storage: S3-compatible (MinIO self-hosted to start)
- Reverse proxy + TLS: Caddy or Nginx
- Backups: daily base backup + WAL archiving
- Monitoring: Prometheus + Grafana (or lightweight logs first)

This keeps your current app architecture compatible with minimal rewrite.

## Why this is the best fit here

- Your code already uses Supabase client patterns (`auth`, `rpc`, table CRUD).
- You need relational data + role-based access + sync workflows.
- You may need GIS extensions later (`PostGIS`) for viewport queries and geometry checks.
- You can start very cheap and scale by adding replicas and splitting services.

## Deployment blueprint

## Stage A — Local dev backend (free)

Use local Supabase for development and schema iteration.

- Run Supabase locally (Docker-based stack).
- Apply `docs/supabase/bootstrap.sql`.
- Point `web/.env.local` and mobile Supabase config to local URL and anon key.

Use this stage for schema and policy hardening only.

## Stage B — Single production node (low-cost)

Start with one Linux VM (example profile: 4 vCPU, 8–16 GB RAM, NVMe SSD).

- Host:
  - Supabase services (or Postgres + your API if you choose custom stack)
  - MinIO (media)
  - Caddy/Nginx
- Security:
  - Private DB port (no public Postgres)
  - Firewall allow only 80/443
  - SSH keys only
- Reliability:
  - Nightly snapshot + offsite backup
  - WAL retention and restore test monthly

This is usually enough for early growth if queries and indexes are healthy.

## Stage C — Scale-out (large usage)

When load grows, keep Postgres as source of truth and split responsibilities.

- Move Postgres to dedicated machine (more RAM + fast NVMe).
- Add read replicas for heavy read endpoints.
- Add PgBouncer for connection pooling.
- Add Redis for cache/session/rate limits if needed.
- Move storage to managed/object cluster later if media volume grows.
- Keep app/stateless services horizontally scalable.

## Minimum production checklist

- Replace permissive dev RLS policies with membership-based policies.
- Enforce JWT auth on all table access paths.
- Add indexes for frequent filters:
  - `features(layer_id)`
  - `features(status)`
  - `corrections(feature_id)`
  - `corrections(layer_id)`
  - `project_members(project_id, user_id)`
- Set DB connection pooling (PgBouncer) before concurrency spikes.
- Set backup + restore drills (not just backup jobs).
- Add basic observability:
  - API error rate
  - DB CPU/memory/connections
  - slow query logging

## Cost strategy (realistic)

You can avoid paid **database services**, but not infrastructure cost at scale.

- Free-to-start: local/self-host dev and testing.
- Low-cost production: single VM + backups.
- Scale cost grows mainly with:
  - storage IOPS
  - memory for Postgres
  - network egress

## Migration-safe recommendation

Use PostgreSQL-compatible services/interfaces everywhere (already true with Supabase).

This gives you flexibility to move between:
- local self-hosted,
- your own VPS/cluster,
- managed PostgreSQL later (if needed),
without major app rewrites.

## Suggested immediate next steps

1. Follow [docs/deploy-gcp-free.md](deploy-gcp-free.md) for GCP Always Free deployment.
2. Use `deploy/bootstrap.sql` (v2 schema with PostGIS + production RLS).
3. Use `deploy/.env.example` for environment configuration.
4. Add backup scripts and a restore test runbook.
5. Add a small load test for login + feature list + correction submit.
