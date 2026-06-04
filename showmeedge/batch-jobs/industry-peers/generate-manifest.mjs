#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { ensureParentDir } from "./lib/run-log.mjs";
import { DEFAULT_UNIVERSE, filterSymbolUniverse, loadSymbolUniverse, normalizeSymbol } from "./lib/symbols.mjs";

function parseArgs(argv) {
  const args = {
    universe: DEFAULT_UNIVERSE,
    output: null,
    ticker: null,
    maxSymbols: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--universe") {
      args.universe = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--output") {
      args.output = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--ticker") {
      args.ticker = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--max-symbols") {
      args.maxSymbols = Number(requiredValue(arg, next));
      index += 1;
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
  if (!String(args.universe ?? "").trim()) {
    throw new Error("--universe cannot be empty");
  }

  if (args.ticker) {
    normalizeSymbol(args.ticker);
  }

  if (args.maxSymbols != null && (!Number.isInteger(args.maxSymbols) || args.maxSymbols <= 0)) {
    throw new Error("--max-symbols must be a positive integer");
  }
}

function printHelp() {
  console.log(`Usage:
  node batch-jobs/industry-peers/generate-manifest.mjs [options]

Options:
  --universe NAME       CSV universe name in market-api app/data. Default: ${DEFAULT_UNIVERSE}
  --ticker SYMBOL       Generate a manifest for one source ticker.
  --max-symbols N       Limit source tickers for smoke tests.
  --output PATH         Write manifest JSONL to PATH. Defaults to stdout.
  --help                Show this help text
`);
}

export async function generateManifest(options = {}) {
  const args = {
    universe: options.universe ?? DEFAULT_UNIVERSE,
    ticker: options.ticker ?? null,
    maxSymbols: options.maxSymbols ?? null
  };
  validateArgs(args);

  const records = filterSymbolUniverse(await loadSymbolUniverse(args.universe), {
    ticker: args.ticker,
    maxSymbols: args.maxSymbols
  });

  if (args.ticker && records.length === 0) {
    throw new Error(`Ticker ${normalizeSymbol(args.ticker)} was not found in universe ${args.universe}`);
  }

  return records;
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
    console.error(`Failed to generate industry peers manifest: ${error.message}`);
    process.exitCode = 1;
  });
}
