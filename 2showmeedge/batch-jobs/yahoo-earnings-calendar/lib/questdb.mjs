import postgres from "postgres";
import { readFile } from "node:fs/promises";
import { validateIsoDate } from "./dates.mjs";

const DEFAULT_QUESTDB_URL = "postgres://admin:quest@127.0.0.1:8812/qdb";
const TABLE_SQL_URL = new URL("../sql/yahoo_earnings_calendar.sql", import.meta.url);

export function createQuestDbClient(connectionUrl = process.env.QUESTDB_URL ?? DEFAULT_QUESTDB_URL) {
  return postgres(connectionUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10
  });
}

export async function ensureYahooEarningsCalendarTable(sql) {
  const tableSql = await readFile(TABLE_SQL_URL, "utf8");
  await sql.unsafe(tableSql);
}

export async function pingQuestDb(sql) {
  const rows = await sql`SELECT 1`;
  return rows.length > 0;
}

export async function insertYahooEarningsRows({ sql, rows, runId }) {
  if (rows.length === 0) {
    return 0;
  }

  await ensureYahooEarningsCalendarTable(sql);
  for (const row of rows) {
    validateIsoDate(row.date, "row date");

    await sql`
      INSERT INTO yahoo_earnings_calendar (
        earnings_ts,
        symbol,
        company_name,
        event_name,
        earnings_call_time,
        eps_estimate,
        reported_eps,
        surprise_percent,
        market_cap,
        source_url,
        scraped_at,
        run_id
      )
      VALUES (
        to_timestamp(${row.date}, 'yyyy-MM-dd'),
        ${normalizeSymbol(row.symbol)},
        ${emptyToNull(row.companyName)},
        ${emptyToNull(row.eventName)},
        ${emptyToNull(row.earningsCallTime)},
        ${nullableNumber(row.epsEstimate)},
        ${nullableNumber(row.reportedEps)},
        ${nullableNumber(row.surprisePercent)},
        ${emptyToNull(row.marketCap)},
        ${emptyToNull(row.sourceUrl)},
        now(),
        ${runId}
      )
    `;
  }

  return rows.length;
}

function normalizeSymbol(value) {
  return String(value ?? "").trim().toUpperCase();
}

function emptyToNull(value) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function nullableNumber(value) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
