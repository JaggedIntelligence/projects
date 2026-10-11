import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Explicitly load .env.local
dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: ["./server/db/schema.ts", "./server/db/trading-schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ""   // this is the one taking care ...
  },
  strict: true,
  verbose: true
});
