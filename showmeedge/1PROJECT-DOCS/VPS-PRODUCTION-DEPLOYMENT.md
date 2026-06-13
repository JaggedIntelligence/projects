# ShowMeEdge VPS Production Deployment Plan

Status: design plan  
Target hosting: Hostinger Ubuntu VPS  
Audience: first production release for friends and family  
Recommended style: small, boring, recoverable Docker Compose deployment

## 1. Purpose

This document describes the steps needed to prepare ShowMeEdge for a small production deployment on an Ubuntu VPS.

The goal is not a large-scale cloud architecture. The first production version should be simple enough to operate alone, but safe enough that friends and family can use it without exposing databases, leaking secrets, or losing data after a server issue.

## 2. Current App Inventory

Current repo shape:

- Next.js 14 app using App Router.
- Clerk authentication.
- tRPC API routes inside the Next.js app.
- Postgres application database through Drizzle ORM.
- FastAPI `market-api` service for market data and backtests.
- QuestDB for OHLCV market data.
- Batch jobs for Yahoo daily bars, earnings calendar, industry peers, and related market-data refreshes.
- Existing local Docker Compose file at `scripts/docker-compose.yml`.

Current local compose includes:

- `postgres`
- `questdb`
- `market-api`

Current production gaps:

- The Next.js app is not yet included in Docker Compose.
- The local compose publishes Postgres, QuestDB, and FastAPI ports directly.
- Default database passwords are development-only.
- `db/init.sql` only creates task tables, while the app also uses trading schema tables.
- `middleware.ts` protects some routes, but `/charts` and `/trading` should be reviewed before production.
- `.env.local` and `tipranks-auth.json` appear to be tracked by git and should be treated as secret hygiene issues before deployment.

## 3. Recommended Production Architecture

Use one VPS with Docker Compose:

```text
Internet
  -> HTTPS reverse proxy, ports 80 and 443 only
    -> Next.js web app, internal port 3000
      -> Postgres, internal port 5432
      -> FastAPI market-api, internal port 8000
        -> QuestDB, internal PGWire port 8812

systemd timer or cron
  -> market data refresh scripts
    -> market-api container
      -> QuestDB
```

Recommended services:

- `proxy`: Caddy or Nginx. Prefer Caddy for automatic TLS and low ceremony.
- `web`: Next.js production server.
- `postgres`: application database.
- `questdb`: market data time-series database.
- `market-api`: FastAPI service.
- Optional later: `backup` service or host-level backup scripts.

Public network exposure:

- Public: `80/tcp`, `443/tcp`, and restricted `22/tcp` for SSH.
- Private/internal only: Postgres `5432`, FastAPI `8000`, QuestDB `8812`, QuestDB UI `9000`, QuestDB ILP `9009`.

Do not expose private service ports in production compose unless there is a specific admin need. If admin access is needed, prefer SSH tunnel access instead of public ports.

## 4. VPS Sizing

For the first friends-and-family deployment:

- Recommended: 2 vCPU, 4 GB RAM, 80 GB disk.
- Minimum trial size: 1 to 2 vCPU, 2 GB RAM, 50 GB disk, with swap enabled.
- Add 2 GB swap on small VPS plans.

Reasoning:

- Next.js plus Postgres is light.
- QuestDB and Python market jobs can use meaningful memory during backfills.
- VectorBT and yfinance workflows may be heavier than the web traffic itself.
- Disk usage can grow from QuestDB market history and logs.

## 5. DNS and Domain

Before deployment:

- Buy or choose the production domain.
- Create an `A` record pointing the domain to the VPS IPv4 address.
- Optional: create `www` as a CNAME to the apex domain.
- Wait for DNS propagation.

Example:

```text
showmeedge.com      A      <vps-ip>
www.showmeedge.com  CNAME  showmeedge.com
```

Clerk production configuration must match the final domain:

- Allowed origins: `https://showmeedge.com`
- Sign-in URL: `https://showmeedge.com/sign-in`
- Sign-up URL: `https://showmeedge.com/sign-up`
- After sign-in URL: `https://showmeedge.com/dashboard`
- After sign-up URL: `https://showmeedge.com/dashboard`

## 6. Production Files To Add Later

Recommended files to add in the repo:

```text
Dockerfile
.dockerignore
scripts/docker-compose.prod.yml
scripts/Caddyfile
scripts/env.production.example
scripts/deploy-prod.sh
scripts/backup-postgres.sh
scripts/backup-questdb.sh
scripts/restore-postgres.sh
```

Do not commit real production secrets.

## 7. Next.js Production Container

Add a root `Dockerfile` for the web app.

Recommended approach:

- Use Node 22 or the version supported by the current Next.js stack.
- Enable Corepack.
- Install with pnpm using the existing lockfile.
- Build the app.
- Run `next start` or use Next standalone output.

Consider adding this to `next.config.mjs`:

```js
const nextConfig = {
  output: "standalone",
  experimental: {
    typedRoutes: true
  }
};
```

Standalone output usually gives a smaller production image, but confirm it works with this app before locking it in.

## 8. Production Docker Compose Design

Production compose should be separate from local compose.

High-level shape:

```yaml
services:
  proxy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - web

  web:
    build:
      context: ..
      dockerfile: Dockerfile
    env_file:
      - .env.production
    depends_on:
      - postgres
      - market-api

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: showmeedge
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: showmeedge
    volumes:
      - showmeedge_postgres_data:/var/lib/postgresql/data

  questdb:
    image: questdb/questdb:9.3.5
    volumes:
      - showmeedge_questdb_data:/var/lib/questdb

  market-api:
    build:
      context: ../services/market-api
    env_file:
      - .env.production
    depends_on:
      - questdb

volumes:
  showmeedge_postgres_data:
  showmeedge_questdb_data:
```

Important production rule:

- Avoid `ports:` for Postgres, QuestDB, and market-api.
- Use internal Docker DNS names: `postgres`, `questdb`, `market-api`.
- Only the reverse proxy publishes public ports.

## 9. Reverse Proxy and TLS

Prefer Caddy for first production release because it can automatically request and renew TLS certificates.

Example Caddyfile:

```caddyfile
showmeedge.com, www.showmeedge.com {
  reverse_proxy web:3000
}
```

Keep FastAPI private. The Next.js app should call it through:

```text
MARKET_API_BASE_URL=http://market-api:8000
```

Do not expose `/docs` for FastAPI publicly unless it is protected or temporarily opened during debugging.

## 10. Production Environment Variables

Create a production environment file on the VPS, not in git.

Suggested path:

```text
/opt/showmeedge/.env.production
```

Required values:

```text
NODE_ENV=production

DATABASE_URL=postgres://showmeedge:<password>@postgres:5432/showmeedge

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<clerk-production-publishable-key>
CLERK_SECRET_KEY=<clerk-production-secret-key>
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

MARKET_API_BASE_URL=http://market-api:8000

ALLOWED_ORIGINS=https://showmeedge.com,https://www.showmeedge.com
QUESTDB_HOST=questdb
QUESTDB_PG_PORT=8812
QUESTDB_USER=admin
QUESTDB_PASSWORD=<questdb-password>
QUESTDB_DATABASE=qdb

POSTGRES_PASSWORD=<postgres-password>
```

Notes:

- `NEXT_PUBLIC_*` values are bundled into the browser. Do not put secrets there.
- `CLERK_SECRET_KEY`, `DATABASE_URL`, `POSTGRES_PASSWORD`, and `QUESTDB_PASSWORD` must stay server-only.
- Generate strong unique passwords for production.

## 11. Database Migration Strategy

Production should use Drizzle migrations, not `db/init.sql` as the source of truth.

Current issue:

- `db/init.sql` creates only task schema.
- The app also imports `server/db/trading-schema.ts`.
- A fresh production database needs all schema objects.

Recommended changes:

- Update `drizzle.config.ts` so it can use `DATABASE_URL` from the environment in production.
- Keep `.env.local` only for local development.
- Run migrations during deploy before restarting web traffic.

Example deploy sequence:

```bash
docker compose -f scripts/docker-compose.prod.yml run --rm web pnpm run db:migrate
docker compose -f scripts/docker-compose.prod.yml up -d
```

If the web production image does not include dev dependencies like `drizzle-kit`, create a separate migration image or run migrations from a one-off deploy container that includes tooling.

## 12. Auth and Route Protection

Review protected routes before production.

Current middleware protects:

```text
/dashboard
/tasks
/backtest
/api/trpc
```

Routes that should be reviewed:

```text
/charts
/trading
```

Recommended first production policy:

- Protect the entire app group under `app/(app)`.
- Keep only `/`, `/sign-in`, and `/sign-up` public.
- Keep all tRPC routes protected unless explicitly designed as public.

Suggested middleware matcher concept:

```text
/dashboard(.*)
/tasks(.*)
/backtest(.*)
/charts(.*)
/trading(.*)
/api/trpc(.*)
```

Also review the landing page experience. Friends and family should understand whether the app is invitation-only or open sign-up.

## 13. Secret Hygiene Before Deployment

Before pushing to a remote server or GitHub:

- Stop tracking `.env.local`.
- Stop tracking `tipranks-auth.json`.
- Rotate any Clerk keys, database passwords, session cookies, or API tokens that may have been committed.
- Add local-only auth/session files to `.gitignore`.
- Check git history if the repo has already been pushed.

Suggested `.gitignore` additions:

```text
.env.local
.env.production
.env*.production
tipranks-auth.json
services/market-api/logs/*
batch-jobs/**/LOG/*
```

Keep `.env.example` and `scripts/env.production.example` committed with placeholder values only.

## 14. VPS Base Setup

Recommended server path:

```text
/opt/showmeedge
```

Initial setup checklist:

- Provision Hostinger Ubuntu VPS.
- Prefer Hostinger Docker template if available.
- Create a non-root deploy user.
- Add SSH public key authentication.
- Disable password SSH after confirming key login.
- Install Docker and Docker Compose if not using the Docker template.
- Enable UFW or Hostinger firewall.
- Enable unattended security updates.
- Add swap on small VPS plans.

Suggested firewall policy:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Docker can bypass some UFW expectations when ports are published. The production compose should avoid publishing private ports, so the firewall and compose design work together.

## 15. Deployment Workflow

First deployment:

1. Create DNS records.
2. Create Clerk production app and configure domain URLs.
3. SSH into VPS.
4. Create deploy user and `/opt/showmeedge`.
5. Clone repo into `/opt/showmeedge`.
6. Create `/opt/showmeedge/.env.production`.
7. Build containers.
8. Start Postgres and QuestDB.
9. Run Drizzle migrations.
10. Start web, market-api, and proxy.
11. Check HTTPS.
12. Sign in through Clerk.
13. Verify dashboard, charts, backtest, and trading pages.
14. Run a small market-data smoke job.
15. Configure backups.
16. Configure scheduled daily update jobs.

Ongoing deployment:

```bash
cd /opt/showmeedge
git pull
docker compose -f scripts/docker-compose.prod.yml build
docker compose -f scripts/docker-compose.prod.yml run --rm web pnpm run db:migrate
docker compose -f scripts/docker-compose.prod.yml up -d
docker compose -f scripts/docker-compose.prod.yml ps
```

Create `scripts/deploy-prod.sh` later to make this repeatable.

## 16. Smoke Tests

After deploy:

```bash
docker compose -f scripts/docker-compose.prod.yml ps
curl -I https://showmeedge.com
curl https://showmeedge.com/sign-in
```

Inside the VPS:

```bash
docker compose -f scripts/docker-compose.prod.yml exec -T market-api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health').read())"
docker compose -f scripts/docker-compose.prod.yml exec -T market-api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/questdb/health').read())"
```

Manual browser checks:

- Home page loads over HTTPS.
- Sign-in redirects work.
- After sign-in, `/dashboard` loads.
- `/charts` loads, can request market bars, and the days-back replay plus Track Trade controls update visible rows correctly.
- `/backtest` can run a small backtest.
- `/trading` routes do not expose anything unintended.

## 17. Market Data Jobs

Current scripts:

- `batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh`
- `batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh`

First production sequence:

1. Start QuestDB and market-api.
2. Run a small smoke backfill with `--max-symbols 5`.
3. Confirm QuestDB data exists.
4. Run the full S&P 500 backfill during a quiet time.
5. Run Forex backfill if needed.
6. Configure daily update jobs.

Current desired EOD refresh times from repo notes:

```text
9:40 AM ET
11:00 AM ET
1:00 PM ET
4:20 PM ET
```

Recommended scheduling:

- Use systemd timers for reliability and logs, or cron for simplicity.
- Be explicit about timezone because the VPS may use UTC.
- Adapt the batch scripts so the compose file path can be set to production compose.

Recommended script improvement:

```text
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/scripts/docker-compose.yml}"
```

That lets production run:

```bash
COMPOSE_FILE=/opt/showmeedge/scripts/docker-compose.prod.yml \
  bash batch-jobs/yahoo-daily-bars-data/update-sp500-eod-safe.sh
```

## 18. Backups

Back up three things:

- Postgres data.
- QuestDB data.
- Production `.env.production` separately and securely.

Postgres backup:

```bash
docker compose -f scripts/docker-compose.prod.yml exec -T postgres \
  pg_dump -U showmeedge -d showmeedge > backups/postgres/showmeedge-$(date +%Y%m%d-%H%M%S).sql
```

QuestDB backup options:

- Stop QuestDB briefly and copy/snapshot the volume.
- Use Hostinger VPS snapshots.
- Keep rebuild scripts available because market data can often be refetched.

Backup frequency:

- Postgres: daily.
- QuestDB: daily or weekly depending on data size.
- VPS snapshot: before major deployments and at least weekly.

Retention:

- Keep 7 daily backups.
- Keep 4 weekly backups.
- Keep 3 monthly backups if storage allows.

Most important rule:

- Test restore once before trusting the backup plan.

## 19. Monitoring and Operations

Minimum monitoring:

- External uptime monitor for `https://showmeedge.com`.
- Docker health checks for web, market-api, Postgres, and QuestDB.
- Disk usage check.
- Backup success/failure notification.
- Batch job failure notification.

Useful commands:

```bash
docker compose -f scripts/docker-compose.prod.yml ps
docker compose -f scripts/docker-compose.prod.yml logs --tail=100 web
docker compose -f scripts/docker-compose.prod.yml logs --tail=100 market-api
df -h
free -h
docker system df
```

Log policy:

- Keep app logs readable with `docker compose logs`.
- Keep market API logs mounted if useful.
- Add logrotate or periodic cleanup for batch job logs.
- Avoid committing logs.

## 20. Security Checklist

Before inviting users:

- HTTPS works.
- SSH key login works.
- Password SSH is disabled.
- Firewall exposes only SSH, HTTP, HTTPS.
- Private Docker services do not publish ports.
- Production secrets are not committed.
- Clerk uses production keys.
- Clerk redirect URLs use production domain.
- App routes are intentionally public or private.
- Database passwords are unique.
- Backups are configured and restore-tested.
- Admin dashboards are not public.
- Batch jobs do not write secrets into logs.

## 21. Recovery Playbook

If web app is down:

```bash
docker compose -f scripts/docker-compose.prod.yml ps
docker compose -f scripts/docker-compose.prod.yml logs --tail=200 web
docker compose -f scripts/docker-compose.prod.yml restart web
```

If market charts fail:

```bash
docker compose -f scripts/docker-compose.prod.yml logs --tail=200 market-api
docker compose -f scripts/docker-compose.prod.yml exec -T market-api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/questdb/health').read())"
```

If disk is full:

```bash
df -h
docker system df
docker compose -f scripts/docker-compose.prod.yml logs --tail=50
```

Clean only known disposable data:

- Old Docker build cache.
- Old batch logs.
- Old backups after confirming retention policy.

Do not delete database volumes unless restoring from backup.

## 22. Implementation Checklist

Phase 1, repo prep:

- Add production web Dockerfile.
- Add `.dockerignore`.
- Add `scripts/docker-compose.prod.yml`.
- Add `scripts/Caddyfile`.
- Add `scripts/env.production.example`.
- Update `next.config.mjs` if using standalone output.
- Update `drizzle.config.ts` for production env handling.
- Update route protection for `/charts` and `/trading`.
- Update `.gitignore` for secrets and logs.
- Remove tracked secret/session files from git.

Phase 2, VPS prep:

- Provision Ubuntu VPS.
- Set DNS.
- Create deploy user.
- Install Docker/Compose.
- Configure firewall.
- Add swap if needed.
- Clone repo to `/opt/showmeedge`.
- Create `.env.production`.

Phase 3, first launch:

- Build stack.
- Start databases.
- Run migrations.
- Start app and proxy.
- Verify HTTPS.
- Verify Clerk sign-in.
- Verify market API health.
- Run smoke data job.

Phase 4, operations:

- Configure backups.
- Test restore.
- Configure daily market-data jobs.
- Configure uptime monitoring.
- Document routine deploy command.

## 23. Open Questions

- What production domain will be used?
- Should sign-up be open to anyone with the URL, or invite-only through Clerk?
- Should QuestDB UI ever be accessible from outside the VPS?
- How much historical market data should be kept on the VPS?
- Should batch job failure alerts go to email, Slack, or only logs for now?
- Is the Hostinger VPS plan at least 4 GB RAM, or should swap and job batch sizes be tuned for a smaller box?

## 24. References

- Hostinger Docker VPS template: https://www.hostinger.com/support/8306612-how-to-use-the-docker-vps-template
- Hostinger Ubuntu UFW guide: https://www.hostinger.com/tutorials/how-to-configure-firewall-on-ubuntu-using-ufw/
- Docker Compose docs: https://docs.docker.com/compose/
- Caddy docs: https://caddyserver.com/docs/
- Drizzle migrations docs: https://orm.drizzle.team/docs/migrations
- Clerk production setup docs: https://clerk.com/docs/deployments/overview
