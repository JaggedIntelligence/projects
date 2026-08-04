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

function parseArgs(argv) {
  const args = {
    ticker: DEFAULT_TICKER,
    output: null,
    headless: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    includeSource: false
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
}

function printHelp() {
  console.log(`Usage:
  node batch-jobs/webscrape-template/generate-peers-manifest.mjs [options]

Options:
  --ticker AAPL           Stock ticker. Default: ${DEFAULT_TICKER}
  --output PATH           Write peer records as JSONL to PATH. Defaults to stdout.
  --include-source        Include the source ticker card from Yahoo's carousel
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
    console.error(`Failed to generate Yahoo industry peers manifest: ${error.message}`);
    process.exitCode = 1;
  });
}
