#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { dirname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import {
  DEFAULT_TICKER,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  normalizeTicker,
  scrapeIndustryPeerRecords
} from "./industry-peers.mjs";
import {
  DEFAULT_PROGRAM_ID,
  createQuestDbClient,
  insertIndustryPeerRows,
  normalizeSnapshotTimestamp,
  pingQuestDb
} from "./lib/questdb.mjs";

function parseArgs(argv) {
  const args = {
    ticker: DEFAULT_TICKER,
    output: null,
    headless: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    includeSource: false,
    insertQuestDb: false,
    dryRun: false,
    questdbUrl: process.env.QUESTDB_URL ?? null,
    programId: DEFAULT_PROGRAM_ID,
    runId: createRunId(),
    snapshotTs: new Date().toISOString()
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--ticker") {
      args.ticker = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--output") {
      args.output = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--timeout-ms") {
      args.timeoutMs = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--include-source") {
      args.includeSource = true;
    } else if (arg === "--insert-questdb") {
      args.insertQuestDb = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--questdb-url") {
      args.questdbUrl = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--program-id") {
      args.programId = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--run-id") {
      args.runId = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--snapshot-ts") {
      args.snapshotTs = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--headful") {
      args.headless = false;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  validateArgs(args);
  return args;
}

function requiredValue(flag, value) {
  if (value == null || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function validateArgs(args) {
  normalizeTicker(args.ticker);

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error("--timeout-ms must be a positive number");
  }

  normalizeSnapshotTimestamp(args.snapshotTs);
}

function createRunId(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function printHelp() {
  console.log(`Usage:
  node batch-jobs/industry-peers/generate-peers-manifest.mjs [options]

Options:
  --ticker AAPL           Stock ticker. Default: ${DEFAULT_TICKER}
  --output PATH           Write peer records as JSONL to PATH. Defaults to stdout.
  --include-source        Include the source ticker card from Yahoo's carousel
  --insert-questdb        Insert scraped peers into QuestDB industry_peers
  --dry-run               Skip QuestDB insertion when used with --insert-questdb
  --questdb-url URL       QuestDB PGWire URL. Default: QUESTDB_URL or postgres://admin:quest@127.0.0.1:8812/qdb
  --program-id VALUE      Program/source id for QuestDB rows. Default: ${DEFAULT_PROGRAM_ID}
  --run-id VALUE          Run identifier for QuestDB rows. Default: current UTC timestamp
  --snapshot-ts VALUE     Snapshot timestamp for QuestDB rows. Default: current UTC timestamp
  --timeout-ms NUMBER     Page timeout in milliseconds. Default: ${DEFAULT_TIMEOUT_MS}
  --headful               Show the browser window instead of running headless
  --help                  Show this help text
`);
}

export async function generateManifest(options = {}) {
  const args = {
    ticker: options.ticker ?? DEFAULT_TICKER,
    headless: options.headless ?? true,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    includeSource: options.includeSource ?? false
  };
  validateArgs(args);

  const browser = await chromium.launch({ headless: args.headless });

  try {
    const page = await browser.newPage({
      userAgent: DEFAULT_USER_AGENT,
      viewport: { width: 1280, height: 720 }
    });

    const records = [];
    const peerRecords = await scrapeIndustryPeerRecords({
      page,
      ticker: args.ticker,
      timeoutMs: args.timeoutMs,
      includeSource: args.includeSource
    });
    records.push(...peerRecords);

    return records;
  } finally {
    await browser.close();
  }
}

async function writeManifest({ output, records }) {
  const content = records.map((record) => JSON.stringify(record)).join("\n");
  const jsonl = content ? `${content}\n` : "";

  if (!output) {
    process.stdout.write(jsonl);
    return;
  }

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, jsonl, "utf8");
}

async function maybeInsertQuestDb({ args, records }) {
  if (!args.insertQuestDb) {
    return;
  }

  if (args.dryRun) {
    console.error(
      JSON.stringify(
        {
          event: "questdb_dry_run",
          table: "industry_peers",
          runId: args.runId,
          programId: args.programId,
          snapshotTs: normalizeSnapshotTimestamp(args.snapshotTs).toISOString(),
          rowsScraped: records.length,
          rowsInserted: 0,
          dryRun: true
        },
        null,
        2
      )
    );
    return;
  }

  const sql = createQuestDbClient(args.questdbUrl ?? undefined);

  try {
    await pingQuestDb(sql);
    const rowsInserted = await insertIndustryPeerRows({
      sql,
      rows: records,
      snapshotTs: args.snapshotTs,
      programId: args.programId,
      runId: args.runId
    });

    console.error(
      JSON.stringify(
        {
          event: "questdb_insert_complete",
          table: "industry_peers",
          runId: args.runId,
          programId: args.programId,
          snapshotTs: normalizeSnapshotTimestamp(args.snapshotTs).toISOString(),
          rowsScraped: records.length,
          rowsInserted,
          dryRun: false
        },
        null,
        2
      )
    );
  } finally {
    await sql.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const records = await generateManifest(args);
  await writeManifest({ output: args.output, records });
  await maybeInsertQuestDb({ args, records });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Failed to generate Yahoo industry peers manifest: ${error.message}`);
    process.exitCode = 1;
  });
}
