import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as baseSchema from "@/server/db/schema";
import * as tradingSchema from "@/server/db/trading-schema";

const schema = {
  ...baseSchema,
  ...tradingSchema
};

const connectionString = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/second_brain";

const client = postgres(connectionString, {
  max: 1,
  prepare: false
});

export const db = drizzle(client, { schema });
