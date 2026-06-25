#!/usr/bin/env node

import { JSDOM } from "jsdom";
import { dirname, join } from "node:path";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_YEAR = 2026;
export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_RETRIES = 2;
export const DEFAULT_RETRY_DELAY_MS = 1_500;
export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
export const STOCKANALYSIS_IPO_BASE_URL = "https://stockanalysis.com/ipos";
export const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CSV_OUTPUT = join(SCRIPT_DIR, `ipo_symbols_${DEFAULT_YEAR}.csv`);
export const IPO_TABLE_SELECTOR = "table#main-table";
export const IPO_TABLE_HEADERS = ["IPO Date", "Symbol", "Company Name", "IPO Price", "Current", "Return"];
export const IPO_CSV_COLUMNS = ["ipo_date", "symbol", "company_name", "ipo_price", "current", "return"];

const MONTH_NUMBERS = new Map([
  ["Jan", "01"],
  ["Feb", "02"],
  ["Mar", "03"],
  ["Apr", "04"],
  ["May", "05"],
  ["Jun", "06"],
  ["Jul", "07"],
  ["Aug", "08"],
  ["Sep", "09"],
  ["Oct", "10"],
  ["Nov", "11"],
  ["Dec", "12"]
]);

export function buildIpoUrl(year = DEFAULT_YEAR, page = 1) {
  validateYear(year);
  validatePositiveInteger("--page", page);

  return `${STOCKANALYSIS_IPO_BASE_URL}/${year}/?page=${page}`;
}

export async function scrapeIpoSymbols({
  url = buildIpoUrl(DEFAULT_YEAR),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS
} = {}) {
  validateTimeout(timeoutMs);
  validateNonNegativeInteger("--retries", retries);
  validateNonNegativeInteger("--retry-delay-ms", retryDelayMs);

  const html = await fetchTextWithRetries({ url, timeoutMs, retries, retryDelayMs });
  return extractIpoTableRows(html);
}

async function fetchTextWithRetries({ url, timeoutMs, retries, retryDelayMs }) {
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, timeoutMs);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      if (attempt > retries) {
        throw new Error(`Could not fetch ${url} after ${attempt} attempt(s): ${error.message}`);
      }

      if (retryDelayMs > 0) {
        await sleep(retryDelayMs * attempt);
      }
    }
  }

  throw new Error(`Could not fetch ${url}`);
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": DEFAULT_USER_AGENT
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function extractIpoTableRows(html) {
  const dom = new JSDOM(html);
  const table = dom.window.document.querySelector(IPO_TABLE_SELECTOR);

  if (!table) {
    throw new Error(`Could not find IPO table selector: ${IPO_TABLE_SELECTOR}`);
  }

  validateHeaders(table, IPO_TABLE_HEADERS);

  const records = Array.from(table.querySelectorAll("tbody tr"))
    .map((row) => Array.from(row.querySelectorAll("td")).map((cell) => compactText(cell.textContent)))
    .filter((cells) => cells.length >= IPO_TABLE_HEADERS.length)
    .map((cells) => ({
      ipoDate: normalizeIpoDate(cells[0]),
      symbol: normalizeSymbol(cells[1]),
      companyName: cells[2],
      ipoPrice: normalizeNumericValue(cells[3]),
      current: normalizeNumericValue(cells[4]),
      return: normalizeNumericValue(cells[5])
    }))
    .filter((record) => record.symbol !== "");

  if (records.length === 0) {
    throw new Error("No IPO table rows found");
  }

  return records;
}

function validateHeaders(table, expectedHeaders) {
  const headerCells = Array.from(table.querySelectorAll("thead th")).map((cell) => compactText(cell.textContent));
  const hasExpectedHeaders = expectedHeaders.every((header, index) => headerCells[index] === header);

  if (!hasExpectedHeaders) {
    throw new Error(`IPO table headers changed. Expected: ${expectedHeaders.join(" | ")}. Found: ${headerCells.join(" | ")}`);
  }
}

function normalizeIpoDate(value) {
  const text = compactText(value);
  const match = /^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/.exec(text);

  if (!match) {
    throw new Error(`Could not parse IPO date: ${JSON.stringify(text)}`);
  }

  const [, monthName, day, year] = match;
  const month = MONTH_NUMBERS.get(monthName);

  if (!month) {
    throw new Error(`Could not parse IPO month: ${JSON.stringify(monthName)}`);
  }

  return `${year}-${month}-${day.padStart(2, "0")}`;
}

function normalizeNumericValue(value) {
  const text = compactText(value);

  if (text === "" || text === "-") {
    return "";
  }

  const normalized = text.replace(/[$,%]/g, "").replace(/,/g, "");

  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`Could not parse numeric value: ${JSON.stringify(text)}`);
  }

  return normalized;
}

function normalizeSymbol(value) {
  return compactText(value).toUpperCase();
}

function compactText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseArgs(argv) {
  const args = {
    page: 1,
    retries: DEFAULT_RETRIES,
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    year: DEFAULT_YEAR
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--csv-output" || arg === "--output") {
      args.csvOutput = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--url") {
      args.url = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--year") {
      args.year = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--page") {
      args.page = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--timeout-ms") {
      args.timeoutMs = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--retries") {
      args.retries = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--retry-delay-ms") {
      args.retryDelayMs = Number(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  validateYear(args.year);
  validatePositiveInteger("--page", args.page);
  validateTimeout(args.timeoutMs);
  validateNonNegativeInteger("--retries", args.retries);
  validateNonNegativeInteger("--retry-delay-ms", args.retryDelayMs);

  args.url ??= buildIpoUrl(args.year, args.page);
  args.csvOutput ??= join(SCRIPT_DIR, `ipo_symbols_${args.year}.csv`);
  return args;
}

function requiredValue(flag, value) {
  if (value == null || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }

  return value;
}

function validateYear(year) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error("--year must be an integer between 1900 and 2100");
  }
}

function validatePositiveInteger(name, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
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

function printHelp() {
  console.log(`Usage:
  node batch-jobs/ipo-symbols-scrape/ipo-symbols-scrape.mjs [options]

Options:
  --csv-output PATH       Write normalized IPO table rows as CSV. Appends rows if the file exists. Default: ${DEFAULT_CSV_OUTPUT}
  --url URL               Scrape a specific StockAnalysis IPO page URL. Default: ${buildIpoUrl(DEFAULT_YEAR)}
  --year NUMBER           StockAnalysis IPO year to scrape. Default: ${DEFAULT_YEAR}
  --page NUMBER           StockAnalysis IPO page number to scrape. Default: 1
  --timeout-ms NUMBER     Fetch timeout in milliseconds. Default: ${DEFAULT_TIMEOUT_MS}
  --retries NUMBER        Retry after fetch failures. Default: ${DEFAULT_RETRIES}
  --retry-delay-ms NUMBER Delay between retries in milliseconds. Default: ${DEFAULT_RETRY_DELAY_MS}
  --help                  Show this help text
`);
}

async function writeCsv({ output, records }) {
  const rows = records.map((record) => [
    record.ipoDate,
    record.symbol,
    record.companyName,
    record.ipoPrice,
    record.current,
    record.return
  ]);
  const rowCsv = rows.map((row) => row.map(formatCsvField).join(",")).join("\n") + "\n";

  await mkdir(dirname(output), { recursive: true });

  const existingCsv = await readExistingCsv(output);

  if (existingCsv == null || existingCsv.length === 0) {
    const headerCsv = IPO_CSV_COLUMNS.map(formatCsvField).join(",") + "\n";
    await writeFile(output, headerCsv + rowCsv, "utf8");
    return "created";
  }

  const separator = existingCsv.endsWith("\n") ? "" : "\n";
  await appendFile(output, separator + rowCsv, "utf8");
  return "appended";
}

async function readExistingCsv(output) {
  try {
    return await readFile(output, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
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

  const records = await scrapeIpoSymbols(args);
  const writeMode = await writeCsv({ output: args.csvOutput, records });

  console.log(`${writeMode === "appended" ? "Appended" : "Wrote"} ${records.length} IPO records`);
  console.log(`CSV: ${args.csvOutput}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Failed to scrape StockAnalysis IPO symbols: ${error.message}`);
    process.exitCode = 1;
  });
}
