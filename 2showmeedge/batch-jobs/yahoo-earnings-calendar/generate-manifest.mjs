#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import { getStrictSundayToSaturdayPairs, validateIsoDate } from "./lib/dates.mjs";
import { ensureParentDir } from "./lib/run-log.mjs";
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  scrapeWeeklyManifestRecords
} from "./lib/yahoo-calendar-carousel.mjs";

const DEFAULT_FROM = "2026-04-05";
const DEFAULT_TO = "2026-04-11";

function parseArgs(argv) {
  const args = {
    from: DEFAULT_FROM,
    to: DEFAULT_TO,
    output: null,
    headless: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    pageSize: DEFAULT_PAGE_SIZE
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--from") {
      args.from = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--to") {
      args.to = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--output") {
      args.output = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--timeout-ms") {
      args.timeoutMs = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--page-size") {
      args.pageSize = Number(requiredValue(arg, next));
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
  validateIsoDate(args.from, "--from");
  validateIsoDate(args.to, "--to");

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error("--timeout-ms must be a positive number");
  }

  if (!Number.isInteger(args.pageSize) || args.pageSize <= 0) {
    throw new Error("--page-size must be a positive integer");
  }
}

function printHelp() {
  console.log(`Usage:
  node batch-jobs/yahoo-earnings-calendar/generate-manifest.mjs [options]

Options:
  --from YYYY-MM-DD       Calendar range start. Default: ${DEFAULT_FROM}
  --to YYYY-MM-DD         Calendar range end. Default: ${DEFAULT_TO}
  --output PATH           Write manifest JSONL to PATH. Defaults to stdout.
  --page-size NUMBER      Yahoo table page size. Default: ${DEFAULT_PAGE_SIZE}
  --timeout-ms NUMBER     Page timeout in milliseconds. Default: ${DEFAULT_TIMEOUT_MS}
  --headful               Show the browser window instead of running headless
  --help                  Show this help text
`);
}

export async function generateManifest(options = {}) {
  const args = {
    from: options.from ?? DEFAULT_FROM,
    to: options.to ?? DEFAULT_TO,
    headless: options.headless ?? true,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    pageSize: options.pageSize ?? DEFAULT_PAGE_SIZE
  };
  validateArgs(args);

  const weekPairs = getStrictSundayToSaturdayPairs(args.from, args.to);
  const browser = await chromium.launch({ headless: args.headless });

  try {
    const page = await browser.newPage({
      userAgent: DEFAULT_USER_AGENT,
      viewport: { width: 1280, height: 720 }
    });

    const records = [];
    for (const [from, to] of weekPairs) {
      const weeklyRecords = await scrapeWeeklyManifestRecords({
        page,
        from,
        to,
        timeoutMs: args.timeoutMs,
        pageSize: args.pageSize
      });
      records.push(...weeklyRecords);
    }

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

  await ensureParentDir(output);
  await writeFile(output, jsonl, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const records = await generateManifest(args);
  await writeManifest({ output: args.output, records });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Failed to generate Yahoo earnings manifest: ${error.message}`);
    process.exitCode = 1;
  });
}

