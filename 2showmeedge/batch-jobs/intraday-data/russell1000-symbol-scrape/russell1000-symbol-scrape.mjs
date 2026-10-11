#!/usr/bin/env node

import { JSDOM } from "jsdom";
import { dirname, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

export const RUSSELL_1000_URL = "https://en.wikipedia.org/wiki/Russell_1000_Index";
export const TABLE_SELECTOR = "table#constituents";
export const TABLE_HEADERS = ["Company", "Symbol", "GICS Sector", "GICS Sub-Industry"];
export const CSV_HEADERS = ["company", "symbol", "gics_sector", "gics_sub_industry"];
export const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CSV_OUTPUT = join(SCRIPT_DIR, "russell1000_current.csv");

export async function scrapeRussell1000(url = RUSSELL_1000_URL) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "showmeedge-russell1000-scraper/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: HTTP ${response.status} ${response.statusText}`);
  }

  return extractRussell1000Rows(await response.text());
}

export function extractRussell1000Rows(html) {
  const document = new JSDOM(html).window.document;
  const table = document.querySelector(TABLE_SELECTOR);

  if (!table) {
    throw new Error(`Could not find Russell 1000 table: ${TABLE_SELECTOR}`);
  }

  const headers = Array.from(table.querySelector("tr")?.querySelectorAll("th, td") ?? []).map((cell) =>
    compactText(cell.textContent)
  );

  if (headers.length !== TABLE_HEADERS.length || headers.some((header, index) => header !== TABLE_HEADERS[index])) {
    throw new Error(`Russell 1000 table headers changed. Expected: ${TABLE_HEADERS.join(" | ")}. Found: ${headers.join(" | ")}`);
  }

  const records = [];
  const seenSymbols = new Set();

  for (const row of table.querySelectorAll("tr")) {
    const cells = Array.from(row.querySelectorAll(":scope > td")).map((cell) => compactText(cell.textContent));

    if (cells.length === 0) {
      continue;
    }

    if (cells.length !== TABLE_HEADERS.length) {
      throw new Error(`Unexpected Russell 1000 row with ${cells.length} cells: ${cells.join(" | ")}`);
    }

    const [company, rawSymbol, gicsSector, gicsSubIndustry] = cells;
    const symbol = rawSymbol.toUpperCase();

    if (!company || !symbol || !gicsSector) {
      throw new Error(`Russell 1000 row is missing a required value: ${cells.join(" | ")}`);
    }

    if (seenSymbols.has(symbol)) {
      throw new Error(`Duplicate Russell 1000 symbol: ${symbol}`);
    }

    seenSymbols.add(symbol);
    records.push({ company, symbol, gicsSector, gicsSubIndustry });
  }

  if (records.length === 0) {
    throw new Error("No Russell 1000 constituent rows found");
  }

  return records;
}

export async function writeCsv(output, records) {
  const rows = records.map(({ company, symbol, gicsSector, gicsSubIndustry }) => [
    company,
    symbol,
    gicsSector,
    gicsSubIndustry
  ]);
  const csv = [CSV_HEADERS, ...rows].map((row) => row.map(formatCsvField).join(",")).join("\n") + "\n";

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, csv, "utf8");
}

function compactText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCsvField(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseArgs(argv) {
  const args = { url: RUSSELL_1000_URL, csvOutput: DEFAULT_CSV_OUTPUT, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--csv-output" || arg === "--output") {
      args.csvOutput = requiredValue(arg, argv[++index]);
    } else if (arg === "--url") {
      args.url = requiredValue(arg, argv[++index]);
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function requiredValue(flag, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }

  return value;
}

function printHelp() {
  console.log(`Usage:
  node batch-jobs/intraday-data/russell1000-symbol-scrape/russell1000-symbol-scrape.mjs [options]

Options:
  --csv-output PATH  Output CSV path. Default: ${DEFAULT_CSV_OUTPUT}
  --url URL          Page to scrape. Default: ${RUSSELL_1000_URL}
  --help             Show this help text
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const records = await scrapeRussell1000(args.url);
  await writeCsv(args.csvOutput, records);
  console.log(`Wrote ${records.length} Russell 1000 records to ${args.csvOutput}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Failed to scrape Russell 1000 symbols: ${error.message}`);
    process.exitCode = 1;
  });
}
