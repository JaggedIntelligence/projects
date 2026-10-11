#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT, normalizeTicker, scrapeIndustryPeerRecords } from "./industry-peers.mjs";
import {
  DEFAULT_PROGRAM_ID,
  countIndustryPeerRows,
  createQuestDbClient,
  ensureIndustryPeersTable,
  insertIndustryPeerRows,
  normalizeSnapshotTimestamp,
  pingQuestDb
} from "./lib/questdb.mjs";
import {
  appendJsonLine,
  createRunId,
  readJsonlFile,
  resetJsonlFile,
  writeJsonFile
} from "./lib/run-log.mjs";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_REQUEST_DELAY_MS = 0;
const DEFAULT_RETRY_DELAY_MS = 5_000;
const RECORD_INSERT_FLAGS = new Set(["skip", "newrecord"]);

function parseArgs(argv) {
  const args = {
    manifest: null,
    rows: null,
    log: null,
    failed: null,
    skipped: null,
    summary: null,
    runId: createRunId(),
    programId: DEFAULT_PROGRAM_ID,
    recordInsertFlag: "skip",
    snapshotTs: new Date().toISOString(),
    headless: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    requestDelayMs: DEFAULT_REQUEST_DELAY_MS,
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    dryRun: false,
    questdbUrl: process.env.QUESTDB_URL ?? null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--manifest") {
      args.manifest = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--rows") {
      args.rows = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--log") {
      args.log = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--failed") {
      args.failed = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--skipped") {
      args.skipped = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--summary") {
      args.summary = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--run-id") {
      args.runId = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--program-id") {
      args.programId = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--record-insert-flag" || arg === "--record_insert_flag") {
      args.recordInsertFlag = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--snapshot-ts") {
      args.snapshotTs = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--timeout-ms") {
      args.timeoutMs = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--max-attempts") {
      args.maxAttempts = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--request-delay-ms") {
      args.requestDelayMs = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--retry-delay-ms") {
      args.retryDelayMs = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--questdb-url") {
      args.questdbUrl = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--headful") {
      args.headless = false;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  applyDefaultOutputPaths(args);
  validateArgs(args);
  return args;
}

function requiredValue(flag, value) {
  if (value == null || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function applyDefaultOutputPaths(args) {
  if (!args.manifest) {
    return;
  }

  const baseDir = dirname(args.manifest);
  args.rows ??= join(baseDir, "rows.jsonl");
  args.log ??= join(baseDir, "ingest.log.jsonl");
  args.failed ??= join(baseDir, "failed-symbols.jsonl");
  args.skipped ??= join(baseDir, "skipped-symbols.jsonl");
  args.summary ??= join(baseDir, "summary.json");
}

function validateArgs(args) {
  if (!args.manifest && !args.help) {
    throw new Error("--manifest is required");
  }

  if (!String(args.programId ?? "").trim()) {
    throw new Error("--program-id cannot be empty");
  }

  if (!RECORD_INSERT_FLAGS.has(args.recordInsertFlag)) {
    throw new Error("--record-insert-flag must be skip or newrecord");
  }

  normalizeSnapshotTimestamp(args.snapshotTs);
  positiveNumberArg("--timeout-ms", args.timeoutMs);
  positiveIntegerArg("--max-attempts", args.maxAttempts);
  nonNegativeNumberArg("--request-delay-ms", args.requestDelayMs);
  nonNegativeNumberArg("--retry-delay-ms", args.retryDelayMs);
}

function positiveIntegerArg(name, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function positiveNumberArg(name, value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}

function nonNegativeNumberArg(name, value) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
}

function printHelp() {
  console.log(`Usage:
  node batch-jobs/industry-peers/ingest-manifest.mjs --manifest PATH [options]

Options:
  --manifest PATH                    Source ticker manifest JSONL from generate-manifest.mjs
  --rows PATH                        Write scraped peer rows JSONL. Default: manifest dir/rows.jsonl
  --log PATH                         Write ingest events JSONL. Default: manifest dir/ingest.log.jsonl
  --failed PATH                      Write failed source tickers JSONL. Default: manifest dir/failed-symbols.jsonl
  --skipped PATH                     Write skipped source tickers JSONL. Default: manifest dir/skipped-symbols.jsonl
  --summary PATH                     Write run summary JSON. Default: manifest dir/summary.json
  --program-id VALUE                 Program/source id. Default: ${DEFAULT_PROGRAM_ID}
  --record_insert_flag skip|newrecord Insert policy. Default: skip
  --record-insert-flag skip|newrecord Alias for --record_insert_flag
  --run-id VALUE                     Run identifier. Default: current UTC timestamp
  --snapshot-ts VALUE                Snapshot timestamp for inserted rows. Default: current UTC timestamp
  --max-attempts NUMBER              Source-ticker attempts. Default: ${DEFAULT_MAX_ATTEMPTS}
  --request-delay-ms NUMBER          Delay between source tickers. Default: ${DEFAULT_REQUEST_DELAY_MS}
  --retry-delay-ms NUMBER            Delay after failed attempts. Default: ${DEFAULT_RETRY_DELAY_MS}
  --timeout-ms NUMBER                Playwright page timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --dry-run                          Scrape and write rows without querying or inserting QuestDB
  --questdb-url URL                  QuestDB PGWire URL. Default: QUESTDB_URL or postgres://admin:quest@127.0.0.1:8812/qdb
  --headful                          Show the browser window instead of running headless
  --help                             Show this help text
`);
}

export async function ingestManifest(options = {}) {
  const args = {
    runId: options.runId ?? createRunId(),
    manifest: options.manifest,
    rows: options.rows,
    log: options.log,
    failed: options.failed,
    skipped: options.skipped,
    summary: options.summary,
    programId: options.programId ?? DEFAULT_PROGRAM_ID,
    recordInsertFlag: options.recordInsertFlag ?? "skip",
    snapshotTs: options.snapshotTs ?? new Date().toISOString(),
    headless: options.headless ?? true,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    requestDelayMs: options.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS,
    retryDelayMs: options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
    dryRun: options.dryRun ?? false,
    questdbUrl: options.questdbUrl ?? process.env.QUESTDB_URL ?? null
  };
  applyDefaultOutputPaths(args);
  validateArgs(args);

  const manifestRecords = (await readJsonlFile(args.manifest)).map(normalizeManifestRecord);
  await resetJsonlFile(args.rows);
  await resetJsonlFile(args.log);
  await resetJsonlFile(args.failed);
  await resetJsonlFile(args.skipped);

  const summary = {
    event: "industry_peers_ingest_complete",
    runId: args.runId,
    manifest: args.manifest,
    universe: manifestRecords[0]?.universe ?? null,
    programId: args.programId,
    recordInsertFlag: args.recordInsertFlag,
    snapshotTs: normalizeSnapshotTimestamp(args.snapshotTs).toISOString(),
    symbolsTotal: manifestRecords.length,
    symbolsSucceeded: 0,
    symbolsSkipped: 0,
    symbolsFailed: 0,
    rowsScraped: 0,
    rowsWritten: 0,
    rowsInserted: 0,
    dryRun: args.dryRun,
    startedAt: new Date().toISOString(),
    finishedAt: null
  };

  let browser;
  let sql;

  try {
    sql = args.dryRun ? null : createQuestDbClient(args.questdbUrl ?? undefined);
    if (sql) {
      await pingQuestDb(sql);
      await ensureIndustryPeersTable(sql);
    }

    if (manifestRecords.length > 0) {
      browser = await chromium.launch({ headless: args.headless });
      const page = await browser.newPage({
        userAgent: DEFAULT_USER_AGENT,
        viewport: { width: 1280, height: 720 }
      });

      for (const [recordIndex, record] of manifestRecords.entries()) {
        try {
          if (sql && args.recordInsertFlag === "skip") {
            const existingRows = await countIndustryPeerRows({
              sql,
              sourceTicker: record.sourceTicker,
              programId: args.programId
            });

            if (existingRows > 0) {
              summary.symbolsSkipped += 1;
              await appendJsonLine(args.skipped, {
                event: "source_ticker_skipped",
                runId: args.runId,
                sourceTicker: record.sourceTicker,
                providerSymbol: record.providerSymbol,
                programId: args.programId,
                existingRows
              });
              await appendJsonLine(args.log, {
                event: "source_ticker_skipped",
                runId: args.runId,
                sourceTicker: record.sourceTicker,
                programId: args.programId,
                existingRows
              });
              continue;
            }
          }

          const rows = await scrapeWithRetry({ page, record, args });
          const insertedRows = sql
            ? await insertIndustryPeerRows({
                sql,
                rows,
                snapshotTs: args.snapshotTs,
                programId: args.programId,
                runId: args.runId
              })
            : 0;

          for (const row of rows) {
            await appendJsonLine(args.rows, row);
          }

          summary.symbolsSucceeded += 1;
          summary.rowsScraped += rows.length;
          summary.rowsWritten += rows.length;
          summary.rowsInserted += insertedRows;

          await appendJsonLine(args.log, {
            event: "source_ticker_success",
            runId: args.runId,
            sourceTicker: record.sourceTicker,
            providerSymbol: record.providerSymbol,
            peerCount: rows.length,
            rowsWritten: rows.length,
            rowsInserted: insertedRows,
            dryRun: args.dryRun
          });
        } catch (error) {
          summary.symbolsFailed += 1;
          await appendJsonLine(args.failed, {
            event: "source_ticker_failed",
            runId: args.runId,
            sourceTicker: record.sourceTicker,
            providerSymbol: record.providerSymbol,
            programId: args.programId,
            attempts: args.maxAttempts,
            lastError: error.message
          });
          await appendJsonLine(args.log, {
            event: "source_ticker_failed",
            runId: args.runId,
            sourceTicker: record.sourceTicker,
            providerSymbol: record.providerSymbol,
            error: error.message
          });
        }

        if (args.requestDelayMs > 0 && recordIndex < manifestRecords.length - 1) {
          await sleep(args.requestDelayMs);
        }
      }
    }
  } finally {
    await browser?.close();
    await sql?.end();
  }

  summary.finishedAt = new Date().toISOString();
  await writeJsonFile(args.summary, summary);
  return summary;
}

async function scrapeWithRetry({ page, record, args }) {
  let lastError;

  for (let attempt = 1; attempt <= args.maxAttempts; attempt += 1) {
    try {
      await appendJsonLine(args.log, {
        event: "source_ticker_attempt_started",
        runId: args.runId,
        sourceTicker: record.sourceTicker,
        providerSymbol: record.providerSymbol,
        attempt
      });

      const rows = await scrapeIndustryPeerRecords({
        page,
        ticker: record.providerSymbol,
        timeoutMs: args.timeoutMs
      });

      return rows.map((row) => ({
        ...row,
        sourceTicker: record.sourceTicker
      }));
    } catch (error) {
      lastError = error;
      await appendJsonLine(args.log, {
        event: "source_ticker_attempt_failed",
        runId: args.runId,
        sourceTicker: record.sourceTicker,
        providerSymbol: record.providerSymbol,
        attempt,
        error: error.message
      });

      if (attempt < args.maxAttempts && args.retryDelayMs > 0) {
        await sleep(args.retryDelayMs);
      }
    }
  }

  throw lastError;
}

function normalizeManifestRecord(record, index) {
  if (!record || typeof record !== "object") {
    throw new Error(`Manifest record ${index + 1} must be an object`);
  }

  const sourceTicker = normalizeTicker(record.sourceTicker);
  const providerSymbol = normalizeTicker(record.providerSymbol ?? sourceTicker);

  return {
    sourceTicker,
    providerSymbol,
    name: emptyToNull(record.name),
    exchange: emptyToNull(record.exchange),
    currency: emptyToNull(record.currency) ?? "USD",
    sector: emptyToNull(record.sector),
    industry: emptyToNull(record.industry),
    universe: emptyToNull(record.universe)
  };
}

function emptyToNull(value) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const summary = await ingestManifest(args);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.symbolsFailed > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Failed to ingest industry peers manifest: ${error.message}`);
    process.exitCode = 1;
  });
}
