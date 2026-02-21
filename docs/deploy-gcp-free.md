# Deploy CorrectionFIELD on Google Cloud Free Tier

Complete step-by-step guide to deploy the self-hosted Supabase backend on GCP Always Free.

---

## What you get for free (forever)

- **1 e2-micro VM** (2 shared vCPU, 1 GB RAM, 30 GB disk)
- **1 external IP** (ephemeral, or $0 if attached to running VM)
- Located in: `us-west1`, `us-central1`, or `us-east1` (free tier regions only)

> 1 GB RAM is tight but works for a small-medium team (10-30 concurrent users).
> For larger teams, upgrade to e2-small ($7/mo) or e2-medium ($14/mo).

---

## Prerequisites

- Google account (Gmail works)
- A domain name (or use the VM's IP directly for testing)
- SSH client (built into GCP Console, or use PuTTY/terminal)

---

## Step 1 — Create GCP account & project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Sign in with your Google account
3. Accept terms → you get $300 free credits for 90 days + Always Free tier
4. Create a new project: **CorrectionFIELD**

---

## Step 2 — Create the free VM

1. Go to **Compute Engine → VM Instances → Create Instance**
2. Configure:
   - **Name:** `correctionfield`
   - **Region:** `us-central1` (or `us-west1` / `us-east1`)
   - **Zone:** any
   - **Machine type:** `e2-micro` (2 shared vCPU, 1 GB) — **free tier eligible**
   - **Boot disk:** Click "Change"
     - OS: **Ubuntu 22.04 LTS**
     - Size: **30 GB** (max free)
     - Type: **Standard persistent disk**
   - **Firewall:** Check both:
     - ✅ Allow HTTP traffic
     - ✅ Allow HTTPS traffic
3. Click **Create**
4. Wait ~1 min for VM to start
5. Note the **External IP** shown in the VM list

---

## Step 3 — Add swap (critical for 1 GB RAM)

Click **SSH** button next to your VM in the console, then run:

```bash
# Add 2 GB swap file (prevents OOM kills)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify
free -h
# Should show ~2 GB swap
```

---

## Step 4 — Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Log out and back in (or run: newgrp docker)
exit
```

SSH back in, then verify:

```bash
docker --version
docker compose version
```

---

## Step 5 — Deploy CorrectionFIELD backend

```bash
# Clone the repo (or just copy the deploy/ folder)
git clone https://github.com/YOUR_USER/CorrectionFIELD.git
cd CorrectionFIELD/deploy

# Create your .env from template
cp .env.example .env

# Generate secrets
JWT_SECRET=$(openssl rand -base64 48)
DB_PASS=$(openssl rand -base64 24)
REALTIME_KEY=$(openssl rand -base64 48)

echo "Generated secrets:"
echo "JWT_SECRET=$JWT_SECRET"
echo "POSTGRES_PASSWORD=$DB_PASS"
echo "REALTIME_SECRET_KEY_BASE=$REALTIME_KEY"
```

Edit `.env` with the generated values:

```bash
nano .env
```

Fill in:
- `DOMAIN=YOUR_EXTERNAL_IP` (or your domain if DNS is set up)
- `API_EXTERNAL_URL=http://YOUR_EXTERNAL_IP:8000` (https if domain + Caddy)
- `SITE_URL=http://YOUR_EXTERNAL_IP:8000`
- `POSTGRES_PASSWORD=` (paste generated)
- `JWT_SECRET=` (paste generated)
- `REALTIME_SECRET_KEY_BASE=` (paste generated)

Generate Supabase API keys from your JWT_SECRET:
- Go to [supabase.com/docs/guides/self-hosting/docker#generate-api-keys](https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys)
- Paste your JWT_SECRET
- Copy the generated `anon` key → `ANON_KEY=`
- Copy the generated `service_role` key → `SERVICE_ROLE_KEY=`

---

## Step 6 — Start the stack

```bash
docker compose up -d

# Check logs (wait 1-2 min for all services to initialize)
docker compose logs -f --tail=50

# Check all containers are running
docker compose ps
```

Expected: all services show `Up` status.

---

## Step 7 — Run bootstrap SQL

Option A — Via Supabase Studio:
1. Open `http://YOUR_EXTERNAL_IP:3000` in browser
2. Go to SQL Editor
3. Paste contents of `bootstrap.sql`
4. Click Run

Option B — Via command line:
```bash
docker compose exec db psql -U postgres -f /docker-entrypoint-initdb.d/init.sql
```

(Only works if you mounted the SQL file in docker-compose volumes)

---

## Step 8 — Create your first user

In Supabase Studio (`http://YOUR_EXTERNAL_IP:3000`):

1. Go to **Authentication → Users**
2. Click **Add user → Create new user**
3. Enter email + password
4. The `on_auth_user_created` trigger will auto-create a profile

Then rerun the seed block in SQL Editor to create the demo project:

```sql
-- Rerun just the seed part from bootstrap.sql
do $$
declare
  v_owner   uuid;
  v_project uuid;
begin
  select id into v_owner from public.profiles order by created_at asc limit 1;
  if v_owner is not null then
    insert into public.projects (slug, name, description, owner_id, settings)
    values (
      'procasef-demo', 'PROCASEF Demo',
      'Projet de démarrage CorrectionFIELD', v_owner,
      '{"default_crs":"EPSG:4326","snap_tolerance":10,"auto_lock":true,"require_validation":true,"offline_enabled":true}'::jsonb
    ) on conflict (slug) do nothing;

    select id into v_project from public.projects where slug = 'procasef-demo' limit 1;
    if v_project is not null then
      insert into public.project_members (project_id, user_id, role)
      values (v_project, v_owner, 'owner')
      on conflict (project_id, user_id) do nothing;
    end if;
  end if;
end $$;
```

---

## Step 9 — Wire your apps

### Web app

Create `web/.env.local`:

```env
VITE_SUPABASE_URL=http://YOUR_EXTERNAL_IP:8000
VITE_SUPABASE_ANON_KEY=YOUR_GENERATED_ANON_KEY
```

### Mobile app

Edit `mobile/src/infra/supabase.ts`:

```typescript
const SUPABASE_URL = 'http://YOUR_EXTERNAL_IP:8000';
const SUPABASE_ANON_KEY = 'YOUR_GENERATED_ANON_KEY';
```

---

## Step 10 — Verify everything works

```bash
# On the server — check DB is healthy
docker compose exec db psql -U postgres -c "SELECT count(*) FROM public.profiles;"
docker compose exec db psql -U postgres -c "SELECT count(*) FROM public.projects;"
docker compose exec db psql -U postgres -c "SELECT PostGIS_Version();"

# From your PC — test the API
curl http://YOUR_EXTERNAL_IP:8000/rest/v1/projects -H "apikey: YOUR_ANON_KEY"
```

In the web app: login should work, project list should load.

---

## Step 11 — Add HTTPS (when you have a domain)

1. Point your domain's A record to the VM's external IP
2. Edit `.env`: set `DOMAIN=api.yourdomain.com`
3. Edit `Caddyfile` to use your domain
4. Restart: `docker compose restart caddy`
5. Caddy auto-provisions Let's Encrypt certificate

---

## Step 12 — Firewall hardening

In GCP Console → **VPC Network → Firewall**:

- Keep: `tcp:80,443` (HTTP/HTTPS) from `0.0.0.0/0`
- Keep: `tcp:22` (SSH) from your IP only
- Add: `tcp:5432` from your office IP only (for QGIS direct connect)
- Block everything else

---

## Step 13 — Backups

```bash
# Add to crontab: daily DB backup at 3 AM
crontab -e

# Add this line:
0 3 * * * docker compose exec -T db pg_dump -U postgres -Fc > /home/$USER/backups/correctionfield_$(date +\%Y\%m\%d).dump

# Create backup dir
mkdir -p ~/backups

# Test restore (on a different DB or locally):
# pg_restore -U postgres -d testdb correctionfield_20260221.dump
```

---

## Memory optimization for e2-micro

The default docker-compose includes memory limits tuned for 1 GB + 2 GB swap:

| Service | Limit | Notes |
|---------|-------|-------|
| PostgreSQL | 400 MB | Main consumer |
| Realtime | 150 MB | WebSocket connections |
| Studio | 120 MB | Admin UI |
| Auth | 100 MB | JWT/session |
| Kong | 100 MB | API gateway |
| PostgREST | 80 MB | REST API |
| Caddy | 30 MB | Reverse proxy |
| **Total** | **~980 MB** | Fits in 1 GB + swap |

If you hit OOM issues, disable Studio (only needed for admin tasks):

```bash
docker compose stop studio
```

---

## Upgrading later

If you need more capacity:
1. Stop VM, change machine type to `e2-small` (2 GB RAM, ~$7/mo) or `e2-medium` (4 GB, ~$14/mo)
2. Remove memory limits from docker-compose
3. Restart: `docker compose up -d`

No code changes needed — same stack, more resources.
