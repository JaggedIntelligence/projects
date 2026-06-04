#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { validateIsoDate } from "./lib/dates.mjs";
import { retryByDate, sleep } from "./lib/retry.mjs";
import {
  appendJsonLine,
  createRunId,
  readJsonlFile,
  resetJsonlFile,
  writeJsonFile
} from "./lib/run-log.mjs";
import {
  createQuestDbClient,
  ensureYahooEarningsCalendarTable,
  insertYahooEarningsRows,
  pingQuestDb
} from "./lib/questdb.mjs";
import { DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT } from "./lib/yahoo-calendar-carousel.mjs";
import { scrapeEarningsRowsFromUrl } from "./lib/yahoo-earnings-table.mjs";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAYS_MS = [10_000, 30_000, 90_000];

function parseArgs(argv) {
  const args = {
    manifest: null,
    rows: null,
    log: null,
    failed: null,
    summary: null,
    runId: createRunId(),
    headless: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    retryDelaysMs: DEFAULT_RETRY_DELAYS_MS,
    requestDelayMs: 0,
    strictCount: true,
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
    } else if (arg === "--summary") {
      args.summary = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--run-id") {
      args.runId = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--timeout-ms") {
      args.timeoutMs = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--max-attempts") {
      args.maxAttempts = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--retry-delays-ms") {
      args.retryDelaysMs = requiredValue(arg, next)
        .split(",")
        .map((value) => Number(value.trim()));
      index += 1;
    } else if (arg === "--request-delay-ms") {
      args.requestDelayMs = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--allow-count-mismatch") {
      args.strictCount = false;
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
  args.failed ??= join(baseDir, "failed-dates.jsonl");
  args.summary ??= join(baseDir, "summary.json");
}

function validateArgs(args) {
  if (!args.manifest && !args.help) {
    throw new Error("--manifest is required");
  }

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error("--timeout-ms must be a positive number");
  }

  if (!Number.isInteger(args.maxAttempts) || args.maxAttempts <= 0) {
    throw new Error("--max-attempts must be a positive integer");
  }

  if (args.retryDelaysMs.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("--retry-delays-ms must be a comma-separated list of non-negative numbers");
  }

  if (!Number.isFinite(args.requestDelayMs) || args.requestDelayMs < 0) {
    throw new Error("--request-delay-ms must be a non-negative number");
  }
}

function printHelp() {
  console.log(`Usage:
  node batch-jobs/yahoo-earnings-calendar/ingest-manifest.mjs --manifest PATH [options]

Options:
  --manifest PATH             Date-grouped manifest JSONL from generate-manifest.mjs
  --rows PATH                 Write scraped rows JSONL. Default: manifest dir/rows.jsonl
  --log PATH                  Write ingest events JSONL. Default: manifest dir/ingest.log.jsonl
  --failed PATH               Write failed dates JSONL. Default: manifest dir/failed-dates.jsonl
  --summary PATH              Write run summary JSON. Default: manifest dir/summary.json
  --run-id VALUE              Run identifier. Default: current UTC timestamp
  --max-attempts NUMBER       Date-level attempts. Default: ${DEFAULT_MAX_ATTEMPTS}
  --retry-delays-ms LIST      Comma-separated retry delays. Default: ${DEFAULT_RETRY_DELAYS_MS.join(",")}
  --request-delay-ms NUMBER   Delay between Yahoo page requests. Default: 0
  --timeout-ms NUMBER         Page timeout in milliseconds. Default: ${DEFAULT_TIMEOUT_MS}
  --allow-count-mismatch      Log count mismatches instead of failing the date
  --dry-run                   Scrape and write rows JSONL without inserting QuestDB
  --questdb-url URL           QuestDB PGWire URL. Default: QUESTDB_URL or postgres://admin:quest@127.0.0.1:8812/qdb
  --headful                   Show the browser window instead of running headless
  --help                      Show this help text
`);
}

export async function ingestManifest(options) {
  const args = {
    runId: options.runId ?? createRunId(),
    manifest: options.manifest,
    rows: options.rows,
    log: options.log,
    failed: options.failed,
    summary: options.summary,
    headless: options.headless ?? true,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    retryDelaysMs: options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS,
    requestDelayMs: options.requestDelayMs ?? 0,
    strictCount: options.strictCount ?? true,
    dryRun: options.dryRun ?? false,
    questdbUrl: options.questdbUrl ?? process.env.QUESTDB_URL ?? null
  };
  applyDefaultOutputPaths(args);
  validateArgs(args);

  const manifestRecords = (await readJsonlFile(args.manifest)).map(normalizeManifestRecord);
  await resetJsonlFile(args.rows);
  await resetJsonlFile(args.log);
  await resetJsonlFile(args.failed);

  const summary = {
    event: "ingest_complete",
    runId: args.runId,
    manifest: args.manifest,
    datesTotal: manifestRecords.length,
    datesSucceeded: 0,
    datesFailed: 0,
    rowsScraped: 0,
    rowsWritten: 0,
    rowsInserted: 0,
    dryRun: args.dryRun,
    startedAt: new Date().toISOString(),
    finishedAt: null
  };

  const browser = await chromium.launch({ headless: args.headless });
  const sql = args.dryRun ? null : createQuestDbClient(args.questdbUrl ?? undefined);

  try {
    if (sql) {
      await pingQuestDb(sql);
      await ensureYahooEarningsCalendarTable(sql);
    }

    const page = await browser.newPage({
      userAgent: DEFAULT_USER_AGENT,
      viewport: { width: 1280, height: 720 }
    });

    for (const record of manifestRecords) {
      try {
        const { rows, insertedRows } = await retryByDate({
          date: record.date,
          maxAttempts: args.maxAttempts,
          delaysMs: args.retryDelaysMs,
          operation: async (attempt) => {
            await appendJsonLine(args.log, {
              event: "date_attempt_started",
              runId: args.runId,
              date: record.date,
              attempt,
              expectedCount: record.expectedCount,
              urlCount: record.urls.length
            });

            const rowsForDate = await scrapeDateRecord({
              page,
              record,
              timeoutMs: args.timeoutMs,
              requestDelayMs: args.requestDelayMs
            });

            validateDateRows({ record, rows: rowsForDate, strictCount: args.strictCount });
            const insertedRows = sql
              ? await insertYahooEarningsRows({ sql, rows: rowsForDate, runId: args.runId })
              : 0;

            return {
              rows: rowsForDate,
              insertedRows
            };
          },
          onAttemptFailure: async ({ date, attempt, error }) => {
            await appendJsonLine(args.log, {
              event: "date_attempt_failed",
              runId: args.runId,
              date,
              attempt,
              error: error.message
            });
          }
        });

        for (const row of rows) {
          await appendJsonLine(args.rows, row);
        }

        summary.datesSucceeded += 1;
        summary.rowsScraped += rows.length;
        summary.rowsWritten += rows.length;
        summary.rowsInserted += insertedRows;

        await appendJsonLine(args.log, {
          event: "date_success",
          runId: args.runId,
          date: record.date,
          expectedCount: record.expectedCount,
          actualCount: rows.length,
          rowsWritten: rows.length,
          rowsInserted: insertedRows,
          dryRun: args.dryRun
        });
      } catch (error) {
        summary.datesFailed += 1;
        await appendJsonLine(args.failed, {
          event: "date_failed",
          runId: args.runId,
          date: record.date,
          from: record.from,
          to: record.to,
          expectedCount: record.expectedCount,
          urls: record.urls,
          attempts: args.maxAttempts,
          lastError: error.message
        });
      }
    }
  } finally {
    await browser.close();
    await sql?.end();
  }

  summary.finishedAt = new Date().toISOString();
  await writeJsonFile(args.summary, summary);
  return summary;
}

async function scrapeDateRecord({ page, record, timeoutMs, requestDelayMs }) {
  const rows = [];

  for (const [urlIndex, url] of record.urls.entries()) {
    const result = await scrapeEarningsRowsFromUrl({
      page,
      url,
      date: record.date,
      timeoutMs
    });
    rows.push(...result.rows);

    if (requestDelayMs > 0 && urlIndex < record.urls.length - 1) {
      await sleep(requestDelayMs);
    }
  }

  return rows;
}

function normalizeManifestRecord(record, index) {
  if (!record || typeof record !== "object") {
    throw new Error(`Manifest record ${index + 1} must be an object`);
  }

  validateIsoDate(record.date, `manifest record ${index + 1} date`);
  validateIsoDate(record.from, `manifest record ${index + 1} from`);
  validateIsoDate(record.to, `manifest record ${index + 1} to`);

  if (!Number.isInteger(record.expectedCount) || record.expectedCount < 0) {
    throw new Error(`Manifest record ${index + 1} expectedCount must be a non-negative integer`);
  }

  if (!Array.isArray(record.urls) || record.urls.length === 0) {
    throw new Error(`Manifest record ${index + 1} urls must be a non-empty array`);
  }

  return {
    date: record.date,
    label: record.label ?? null,
    from: record.from,
    to: record.to,
    expectedCount: record.expectedCount,
    urls: record.urls.map((url) => String(url))
  };
}

function validateDateRows({ record, rows, strictCount }) {
  if (strictCount && rows.length !== record.expectedCount) {
    throw new Error(
      `Expected ${record.expectedCount} rows for ${record.date}, but scraped ${rows.length}`
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const summary = await ingestManifest(args);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.datesFailed > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Failed to ingest Yahoo earnings manifest: ${error.message}`);
    process.exitCode = 1;
  });
}
