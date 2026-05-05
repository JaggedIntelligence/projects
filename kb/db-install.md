# Drizzle DB Install and Migration Notes

This Next.js project lives under:

```bash
/Users/sreddy/projects/kb/web-ui
```

It uses Drizzle ORM with PostgreSQL. The README identifies the database as Neon Postgres.

## Where The Drizzle Schema Is Defined

The Drizzle database schema is specified in:

```bash
web-ui/lib/db/schema.ts
```

That file defines the PostgreSQL tables with `pgTable`.

The Drizzle config is:

```bash
web-ui/drizzle.config.ts
```

Relevant config:

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
})
```

The runtime DB client is:

```bash
web-ui/lib/db/client.ts
```

Relevant code:

```ts
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

function createDb() {
  const client = postgres(process.env.POSTGRES_URL!)
  return drizzle(client, { schema })
}
```

## Existing Tables In The Schema

The schema currently defines these tables:

```text
marketplaces
marketplace_stats
marketplace_install_stats
plugins
skills
mcp_servers
mcp_server_stats
```

## Environment Variable

Database features require:

```bash
POSTGRES_URL=postgres://...
```

The README says this is required for database-backed features such as MCP servers, marketplaces, plugins, and skills.

Without `POSTGRES_URL`, the app can still browse some markdown-backed content, but Drizzle migrations cannot be applied.

## Install And Setup Plan

1. Go to the Next.js project directory.

```bash
cd /Users/sreddy/projects/kb/web-ui
```

2. Install dependencies if needed.

```bash
npm install
```

In this workspace, dependencies were already present, but `node_modules` had an `esbuild` platform mismatch. It contained Linux arm64 `esbuild`, while this machine needs Darwin arm64.

3. Add a database environment variable.

Create or update:

```bash
web-ui/.env.local
```

Add:

```bash
POSTGRES_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE
```

For Neon, use the Neon Postgres connection string.

4. Generate migrations from the Drizzle schema.

```bash
cd /Users/sreddy/projects/kb/web-ui
./node_modules/.bin/drizzle-kit generate
```

Equivalent command if `npx` is available:

```bash
npx drizzle-kit generate
```

5. Apply migrations to the database.

```bash
cd /Users/sreddy/projects/kb/web-ui
POSTGRES_URL='postgres://...' ./node_modules/.bin/drizzle-kit migrate
```

Equivalent command if the environment variable is already loaded:

```bash
./node_modules/.bin/drizzle-kit migrate
```

Equivalent command if `npx` is available:

```bash
npx drizzle-kit migrate
```

6. Optional package scripts to add to `web-ui/package.json`.

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio"
}
```

7. Start the app.

```bash
cd /Users/sreddy/projects/kb/web-ui
npm run dev
```

## What Was Done

Migration generation was completed successfully.

Generated migration:

```bash
web-ui/lib/db/migrations/0000_black_micromax.sql
```

Generated Drizzle metadata:

```bash
web-ui/lib/db/migrations/meta/0000_snapshot.json
web-ui/lib/db/migrations/meta/_journal.json
```

The generation command used was:

```bash
cd /Users/sreddy/projects/kb/web-ui
./node_modules/.bin/drizzle-kit generate
```

Output summary:

```text
7 tables
marketplace_install_stats 5 columns 1 indexes 1 fks
marketplace_stats 6 columns 2 indexes 1 fks
marketplaces 21 columns 5 indexes 0 fks
mcp_server_stats 6 columns 2 indexes 1 fks
mcp_servers 30 columns 7 indexes 0 fks
plugins 19 columns 6 indexes 1 fks
skills 15 columns 6 indexes 2 fks

[✓] Your SQL migration file ➜ lib/db/migrations/0000_black_micromax.sql
```

## Apply Status

The migration was not applied because `POSTGRES_URL` is not configured in the current shell.

The apply command attempted was:

```bash
cd /Users/sreddy/projects/kb/web-ui
./node_modules/.bin/drizzle-kit migrate
```

It failed with:

```text
Error Please provide required params for Postgres driver:
[x] url: undefined
```

To apply the generated migration, run:

```bash
cd /Users/sreddy/projects/kb/web-ui
POSTGRES_URL='postgres://...' ./node_modules/.bin/drizzle-kit migrate
```

Replace `postgres://...` with the actual Neon/Postgres connection string.

