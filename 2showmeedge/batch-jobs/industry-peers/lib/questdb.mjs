import postgres from "postgres";
import { readFile } from "node:fs/promises";

import { normalizeTicker } from "../industry-peers.mjs";

const DEFAULT_QUESTDB_URL = "postgres://admin:quest@127.0.0.1:8812/qdb";
const TABLE_SQL_URL = new URL("../sql/industry_peers_table.sql", import.meta.url);

export const DEFAULT_PROGRAM_ID = "yahoo-finance-compare-to";

export function createQuestDbClient(connectionUrl = process.env.QUESTDB_URL ?? DEFAULT_QUESTDB_URL) {
  return postgres(connectionUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10
  });
}

export async function ensureIndustryPeersTable(sql) {
  const tableSql = await readFile(TABLE_SQL_URL, "utf8");
  await sql.unsafe(tableSql);
}

export async function pingQuestDb(sql) {
  const rows = await sql`SELECT 1`;
  return rows.length > 0;
}

export async function countIndustryPeerRows({ sql, sourceTicker, programId = DEFAULT_PROGRAM_ID }) {
  await ensureIndustryPeersTable(sql);
  const rows = await sql`
    SELECT count() AS row_count
    FROM industry_peers
    WHERE source_ticker = ${normalizeTicker(sourceTicker)}
      AND program_id = ${programId}
  `;

  return Number(rows[0]?.row_count ?? 0);
}

export async function insertIndustryPeerRows({
  sql,
  rows = [],
  snapshotTs = new Date(),
  programId = DEFAULT_PROGRAM_ID,
  runId
}) {
  if (!rows.length) {
    return 0;
  }

  await ensureIndustryPeersTable(sql);

  const snapshotTimestamp = toQuestDbTimestampText(snapshotTs);
  const normalizedRows = rows.map(toIndustryPeerDbRow);
  const normalizedProgramId = emptyToNull(programId);
  const normalizedRunId = emptyToNull(runId);

  for (const row of normalizedRows) {
    await sql`
      INSERT INTO industry_peers (
        snapshot_ts,
        source_ticker,
        peer_ticker,
        rank,
        company_name,
        industry,
        program_id,
        run_id
      )
      VALUES (
        to_timestamp(${snapshotTimestamp}, 'yyyy-MM-ddTHH:mm:ss.SSSUUUZ'),
        ${row.sourceTicker},
        ${row.peerTicker},
        ${row.rank},
        ${row.companyName},
        ${row.industry},
        ${normalizedProgramId},
        ${normalizedRunId}
      )
    `;
  }

  return normalizedRows.length;
}

export function toIndustryPeerDbRow(row) {
  if (!row || typeof row !== "object") {
    throw new Error("industry peer row must be an object");
  }

  return {
    sourceTicker: normalizeTicker(row.sourceTicker),
    peerTicker: normalizeTicker(row.peerTicker),
    rank: normalizeRank(row.rank),
    companyName: emptyToNull(row.companyName),
    industry: emptyToNull(row.industry)
  };
}

export function normalizeSnapshotTimestamp(value = new Date()) {
  const timestamp = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(timestamp.valueOf())) {
    throw new Error("snapshot timestamp must be a valid date/time");
  }

  return timestamp;
}

function toQuestDbTimestampText(value) {
  return normalizeSnapshotTimestamp(value).toISOString().replace("Z", "000Z");
}

function normalizeRank(value) {
  const rank = Number(value);

  if (!Number.isInteger(rank) || rank <= 0) {
    throw new Error("industry peer rank must be a positive integer");
  }

  return rank;
}

function emptyToNull(value) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}
