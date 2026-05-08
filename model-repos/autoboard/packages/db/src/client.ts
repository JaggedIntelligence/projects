import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbDir = join(__dirname, "..", "drizzle");
const dbPath = join(dbDir, "db.sqlite");

try {
  mkdirSync(dbDir, { recursive: true });
} catch {
  // Directory might already exist
}

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
