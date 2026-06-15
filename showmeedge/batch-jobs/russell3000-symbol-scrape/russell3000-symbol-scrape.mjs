#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { dirname, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_RETRIES = 2;
export const DEFAULT_PAGE_DELAY_MS = 1_500;
export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
export const DEFAULT_PAGES = [0, 1, 2, 3, 4];
export const RUSSELL_3000_BASE_URL = "https://www.chartmill.com/stock/markets/usa/index/russell-3000";
export const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_JSON_OUTPUT = join(SCRIPT_DIR, "russell3000_list.json");
export const DEFAULT_CSV_OUTPUT = join(SCRIPT_DIR, "russell3000_current.csv");
export const SYMBOL_CSV_COLUMNS = ["symbol", "provider_symbol", "name", "exchange", "currency", "sector", "industry"];
export const RUSSELL_3000_TABLE_SELECTOR = "app-large-table-view table.cm-table";
export const RUSSELL_3000_TABLE_HEADERS = [
  "Symbol",
  "Company",
  "Market Cap",
  "Weight",
  "TA Rating",
  "FA Rating",
  "Div %",
  "% Chg",
  "3M %",
  "1Y %",
  "PE",
  "Analysts"
];

export function buildRussell3000Url(pageIndex) {
  return `${RUSSELL_3000_BASE_URL}?p=${pageIndex}`;
}

export async function scrapeRussell3000Symbols({
  pages = DEFAULT_PAGES,
  headless = true,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
  delayMs = DEFAULT_PAGE_DELAY_MS
} = {}) {
  validatePages(pages);
  validateTimeout(timeoutMs);
  validateNonNegativeInteger("--retries", retries);
  validateNonNegativeInteger("--delay-ms", delayMs);

  const browser = await chromium.launch({ headless });

  try {
    const records = [];
    const seenSymbols = new Set();

  //  NOTE:  code trying individual pages 0 , 1 .. 4 as each new Page scrape  as a FRESH CONTEXT to avoid CloudFlare detection and time out issues. 
  // This is critical design decision to keep in mind for future PAGINATGION based 'web page scrapres'
    for (const pageIndex of pages) {
      const pageRecords = await scrapeRussell3000PageWithFreshContext({
        browser,
        pageIndex,
        timeoutMs,
        retries,
        rankOffset: records.length
      });

      for (const record of pageRecords) {
        if (seenSymbols.has(record.symbol)) {
          continue;
        }

        seenSymbols.add(record.symbol);
        records.push(record);
      }

      if (delayMs > 0 && pageIndex !== pages.at(-1)) {
        await sleep(delayMs);
      }
    }

    return records.map((record, index) => ({
      ...record,
      rank: index + 1
    }));
  } finally {
    await browser.close();
  }
}

async function scrapeRussell3000PageWithFreshContext({ browser, pageIndex, timeoutMs, retries, rankOffset }) {
  validatePages([pageIndex]);
  validateTimeout(timeoutMs);
  validateNonNegativeInteger("--retries", retries);

  const url = buildRussell3000Url(pageIndex);

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const context = await browser.newContext({
      userAgent: DEFAULT_USER_AGENT,
      viewport: { width: 1365, height: 900 }
    });
    const page = await context.newPage();

    try {
      return await scrapeRussell3000Page({
        page,
        pageIndex,
        timeoutMs,
        rankOffset
      });
    } catch (error) {
      if (attempt > retries) {
        const pageState = await getPageState(page);
        throw new Error(
          `Could not scrape ${url} after ${attempt} attempt(s): ${error.message}${pageState ? `; ${pageState}` : ""}`
        );
      }

    } finally {
      await context.close();
    }

    await sleep(2_000 * attempt);
  }

  throw new Error(`Could not scrape ${url}`);
}

export async function scrapeRussell3000Page({ page, pageIndex, timeoutMs = DEFAULT_TIMEOUT_MS, rankOffset = 0 }) {
  validatePages([pageIndex]);
  validateTimeout(timeoutMs);

  const url = buildRussell3000Url(pageIndex);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForSelector(`${RUSSELL_3000_TABLE_SELECTOR} tr`, { state: "attached", timeout: timeoutMs });

  const records = await page.evaluate(extractRussell3000TableRows, {
    expectedHeaders: RUSSELL_3000_TABLE_HEADERS,
    rankOffset,
    tableSelector: RUSSELL_3000_TABLE_SELECTOR
  });

  if (records.length === 0) {
    throw new Error(`No Russell 3000 table rows found at ${url}`);
  }

  return records;
}

function extractRussell3000TableRows({ expectedHeaders, rankOffset, tableSelector }) {
  const table = document.querySelector(tableSelector);
  if (!table) {
    throw new Error(`Could not find Russell 3000 table selector: ${tableSelector}`);
  }

  const rows = Array.from(table.querySelectorAll("tr"));
  validateHeaders(rows, expectedHeaders);

  return rows
    .map((row) => Array.from(row.querySelectorAll("td")).map((cell) => compactText(cell.textContent)))
    .filter((cells) => cells.length >= 12 && isTicker(cells[0]))
    .map((cells, index) => ({
      rank: rankOffset + index + 1,
      symbol: normalizeSymbol(cells[0]),
      companyName: cells[1] || null,
      marketCap: nullIfBlank(cells[2]),
      weight: nullIfBlank(cells[3]),
      taRating: nullIfBlank(cells[4]),
      faRating: nullIfBlank(cells[5]),
      dividendYield: nullIfBlank(cells[6]),
      changePercent: nullIfBlank(cells[7]),
      "3monthChange": nullIfBlank(cells[8]),
      "1yearChange": nullIfBlank(cells[9]),
      peRatio: nullIfBlank(cells[10]),
      analystRating: nullIfBlank(cells[11])
    }));

  function compactText(value) {
    return String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeSymbol(value) {
    return compactText(value).toUpperCase();
  }

  function isTicker(value) {
    return /^[A-Z0-9.-]+$/.test(normalizeSymbol(value));
  }

  function nullIfBlank(value) {
    return value === "" ? null : value;
  }

  function validateHeaders(rows, expected) {
    const headerCells = Array.from(rows[0]?.querySelectorAll("th,td") ?? []).map((cell) => compactText(cell.textContent));
    const hasExpectedHeaders = expected.every((header, index) => headerCells[index] === header);

    if (!hasExpectedHeaders) {
      throw new Error(
        `Russell 3000 table headers changed. Expected: ${expected.join(" | ")}. Found: ${headerCells.join(" | ")}`
      );
    }
  }
}

function parseArgs(argv) {
  const args = {
    jsonOutput: DEFAULT_JSON_OUTPUT,
    csvOutput: DEFAULT_CSV_OUTPUT,
    headless: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    retries: DEFAULT_RETRIES,
    delayMs: DEFAULT_PAGE_DELAY_MS,
    pages: DEFAULT_PAGES
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--json-output" || arg === "--output") {
      args.jsonOutput = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--csv-output") {
      args.csvOutput = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--timeout-ms") {
      args.timeoutMs = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--retries") {
      args.retries = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--delay-ms") {
      args.delayMs = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--pages") {
      args.pages = parsePages(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--headful") {
      args.headless = false;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  validatePages(args.pages);
  validateTimeout(args.timeoutMs);
  validateNonNegativeInteger("--retries", args.retries);
  validateNonNegativeInteger("--delay-ms", args.delayMs);
  return args;
}

function parsePages(value) {
  const values = String(value)
    .split(",")
    .map((page) => page.trim());

  const pages = values.map((page) => Number(page));

  if (values.some((page) => page === "") || pages.some((page) => Number.isNaN(page))) {
    throw new Error("--pages must be a comma-separated list of page numbers");
  }

  if (pages.length === 0) {
    throw new Error("--pages must include at least one page number");
  }

  return pages;
}

function requiredValue(flag, value) {
  if (value == null || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }

  return value;
}

function validatePages(pages) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error("pages must include at least one page number");
  }

  for (const page of pages) {
    if (!Number.isInteger(page) || page < 0) {
      throw new Error("pages must be non-negative integers");
    }
  }
}

function validateTimeout(timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("--timeout-ms must be a positive number");
  }
}

function validateNonNegativeInteger(name, value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

async function getPageState(page) {
  try {
    return await page.evaluate(() => {
      const title = document.title ? `title=${JSON.stringify(document.title)}` : "";
      const text = document.body?.innerText?.replace(/\s+/g, " ").trim().slice(0, 160);
      const bodyText = text ? `body=${JSON.stringify(text)}` : "";

      return [title, bodyText].filter(Boolean).join(" ");
    });
  } catch {
    return "";
  }
}

function printHelp() {
  console.log(`Usage:
  node batch-jobs/russell3000-symbol-scrape/russell3000-symbol-scrape.mjs [options]

Options:
  --json-output PATH      Write Russell 3000 records as a JSON array. Default: ${DEFAULT_JSON_OUTPUT}
  --csv-output PATH       Write symbol CSV. Default: ${DEFAULT_CSV_OUTPUT}
  --pages 0,1,2,3,4       Comma-separated ChartMill page indexes. Default: ${DEFAULT_PAGES.join(",")}
  --timeout-ms NUMBER     Page timeout in milliseconds. Default: ${DEFAULT_TIMEOUT_MS}
  --retries NUMBER        Retry each page after table-load failures. Default: ${DEFAULT_RETRIES}
  --delay-ms NUMBER       Delay between page requests in milliseconds. Default: ${DEFAULT_PAGE_DELAY_MS}
  --headful               Show the browser window instead of running headless
  --help                  Show this help text
`);
}

async function writeArtifacts({ jsonOutput, csvOutput, records }) {
  await Promise.all([writeJson({ output: jsonOutput, records }), writeCsv({ output: csvOutput, records })]);

  console.log(`Wrote ${records.length} Russell 3000 records`);
  console.log(`JSON: ${jsonOutput}`);
  console.log(`CSV: ${csvOutput}`);
}

async function writeJson({ output, records }) {
  const json = `${JSON.stringify(records, null, 2)}\n`;

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, json, "utf8");
}

async function writeCsv({ output, records }) {
  const rows = records.map((record) => [
    record.symbol,
    record.symbol,
    record.companyName ?? "",
    "",
    "",
    "",
    ""
  ]);
  const csv = [SYMBOL_CSV_COLUMNS, ...rows].map((row) => row.map(formatCsvField).join(",")).join("\n") + "\n";

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, csv, "utf8");
}

function formatCsvField(value) {
  const text = String(value ?? "");

  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const records = await scrapeRussell3000Symbols(args);
  await writeArtifacts({ jsonOutput: args.jsonOutput, csvOutput: args.csvOutput, records });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Failed to scrape ChartMill Russell 3000 symbols: ${error.message}`);
    process.exitCode = 1;
  });
}
