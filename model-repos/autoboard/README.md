# Autoboard

Monorepo: Vite + React frontend and Hono API with a layered backend (Controller → Use Case → Persistence).

## Structure

- **apps/web** – Vite + React, Jotai, React Router
- **apps/api** – Hono server, controllers, auto-mode loop
- **packages/db** – Drizzle schema, migrations, repositories
- **packages/domain** – Use cases (business logic)
- **packages/services** – Agent, Claude provider, card-run state
- **packages/shared** – Shared types and errors

## Developing

```bash
pnpm install
pnpm dev
```

Runs the API (port 3001) and the web app (Vite). The web app proxies `/api` to the API.

## Building

```bash
pnpm build
```

## Database

Migrations and DB live in `packages/db`:

```bash
pnpm db:generate   # generate migrations
pnpm db:migrate    # run migrations
pnpm db:push       # push schema
pnpm db:studio     # Drizzle Studio
```

## Engine

Node.js >= 22.
