# Second Brain Task Manager

A full-stack task management app built with Next.js 14 App Router, Tailwind CSS, shadcn/ui-style components, Zustand, Clerk, tRPC, Drizzle ORM, Zod, and Postgres.

## Getting Started

1. Install dependencies:

```bash
corepack enable
pnpm install
```

2. Copy environment values:

```bash
cp .env.example .env.local
```

3. Create a Clerk application with GitHub and Google OAuth enabled, then add the keys to `.env.local`.

4. Start Postgres and create the initial database schema:

```bash
pnpm run db:init
```

This uses Docker Compose to start Postgres at `postgres://postgres:postgres@localhost:5432/second_brain` and applies `db/init.sql`. The helper works with either `docker compose` or the older standalone `docker-compose`. The SQL is idempotent, so the command can be rerun safely.

If you are working inside an OrbStack Ubuntu machine on macOS, run the database commands from a terminal where Docker Compose is available. OrbStack includes Compose for its Docker environment, but a separate Linux machine shell may not have the Docker/Compose CLI linked into it.

Useful database commands:

```bash
pnpm run db:start
pnpm run db:stop
pnpm run db:reset
```

If you prefer Drizzle migrations for later schema changes:

```bash
pnpm run db:generate
pnpm run db:migrate
```

5. Run the app:

```bash
pnpm run dev
```

## Troubleshooting

If Next.js reports a missing file under `.next/server`, or fails to load the SWC binary, reinstall dependencies from the same environment where you run the app:

```bash
rm -rf .next node_modules
corepack enable
pnpm install --optional
pnpm run dev
```

Avoid mixing `npm install` with this repo's pnpm lockfile and pnpm-managed `node_modules`. If you switch between macOS and an OrbStack Ubuntu shell in the same project folder, rerun `pnpm install --optional` after pulling the latest `package.json`; the repo asks pnpm to install the native Next.js SWC packages for both macOS and Linux on Apple Silicon.

## Vite

This is a Next.js app, so runtime bundling is handled by Next. `vite.config.ts` is included for Vitest/unit-test tooling.
