import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import * as schema from './schema';

async function openDatabase() {
  const dataDir = resolve(process.env.TODO_DB_DIR ?? 'data/todo-pglite');
  await mkdir(dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);

  try {
    await client.waitReady;
    const db = drizzle({ client, schema });
    await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
    return db;
  } catch (error) {
    await client.close();
    throw error;
  }
}

let databasePromise: ReturnType<typeof openDatabase> | undefined;

export function getDatabase() {
  return (databasePromise ??= openDatabase());
}
