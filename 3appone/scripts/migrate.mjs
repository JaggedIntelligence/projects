import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const dataDir = resolve(process.env.TODO_DB_DIR ?? 'data/todo-pglite');
await mkdir(dirname(dataDir), { recursive: true });

const client = new PGlite(dataDir);
try {
  await client.waitReady;
  await migrate(drizzle(client), { migrationsFolder: resolve('drizzle') });
  console.log(`Migrations applied to ${dataDir}`);
} finally {
  await client.close();
}
