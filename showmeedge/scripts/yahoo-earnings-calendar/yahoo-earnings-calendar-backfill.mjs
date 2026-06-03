#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";

const DEFAULT_FROM = "2010-05-30";
const DEFAULT_TO = "2010-06-05";
const DEFAULT_DAY = "2010-06-02";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

function parseArgs(argv) {
  const args = {
    from: DEFAULT_FROM,
    to: DEFAULT_TO,
    day: DEFAULT_DAY,
    format: "table",
    headless: true,
    timeoutMs: DEFAULT_TIMEOUT_MS
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
    } else if (arg === "--day") {
      args.day = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--format") {
      args.format = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--timeout-ms") {
      args.timeoutMs = Number(requiredValue(arg, next));
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
  for (const key of ["from", "to", "day"]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args[key])) {
      throw new Error(`--${key} must be in YYYY-MM-DD format`);
    }
  }

  if (!["table", "json"].includes(args.format)) {
    throw new Error("--format must be either table or json");
  }

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error("--timeout-ms must be a positive number");
  }
}

function printHelp() {
  console.log(`Usage:
  node scripts/yahoo-earnings-calendar/yahoo-earnings-calendar-backfill.mjs [options]

Options:
  --from YYYY-MM-DD       Calendar range start. Default: ${DEFAULT_FROM}
  --to YYYY-MM-DD         Calendar range end. Default: ${DEFAULT_TO}
  --day YYYY-MM-DD        Selected calendar day. Default: ${DEFAULT_DAY}
  --format table|json     Output format. Default: table
  --timeout-ms NUMBER     Page timeout in milliseconds. Default: ${DEFAULT_TIMEOUT_MS}
  --headful               Show the browser window instead of running headless
  --help                  Show this help text
`);
}

function buildYahooEarningsUrl({ from, to, day }) {
  const url = new URL("https://finance.yahoo.com/calendar/earnings");
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("day", day);
  return url.toString();
}

export async function scrapeYahooEarningsCalendar(options = {}) {
  const args = {
    from: options.from ?? DEFAULT_FROM,
    to: options.to ?? DEFAULT_TO,
    day: options.day ?? DEFAULT_DAY,
    headless: options.headless ?? true,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  };
  validateArgs({ ...args, format: "json" });

  const url = buildYahooEarningsUrl(args);
  const browser = await chromium.launch({ headless: args.headless });

  try {
    const page = await browser.newPage({
      userAgent: DEFAULT_USER_AGENT,
      viewport: { width: 1280, height: 720 }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: args.timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await page.waitForFunction(hasEarningsTable, null, { timeout: args.timeoutMs });

    const result = await page.evaluate(extractEarningsTable);
    return {
      url,
      requested: {
        from: args.from,
        to: args.to,
        day: args.day
      },
      ...result
    };
  } finally {
    await browser.close();
  }
}

function hasEarningsTable() {
  return Array.from(document.querySelectorAll("table")).some((table) => {
    const headerText = table.innerText || "";
    return headerText.includes("Symbol") && headerText.includes("EPS Estimate") && headerText.includes("Reported EPS");
  });
}

function extractEarningsTable() {
  const table = Array.from(document.querySelectorAll("table")).find((candidate) => {
    const text = candidate.innerText || "";
    return text.includes("Symbol") && text.includes("EPS Estimate") && text.includes("Reported EPS");
  });

  if (!table) {
    throw new Error("Could not find Yahoo earnings table in rendered page");
  }

  const bodyText = document.body.innerText || "";
  const selectedDayLabel = bodyText.match(/Earnings On [^\n]+/)?.[0] ?? null;
  const rangeLabel = bodyText.match(/[A-Z][a-z]{2} \d{1,2}, \d{4} - [A-Z][a-z]{2} \d{1,2}, \d{4}/)?.[0] ?? null;

  const rows = Array.from(table.querySelectorAll("tbody tr")).map((row) => {
    const cells = Array.from(row.querySelectorAll("th, td")).map((cell) => compactText(cell.innerText));
    return {
      symbol: cells[0] || null,
      companyName: cells[1] || null,
      eventName: emptyToNull(cells[2]),
      earningsCallTime: emptyToNull(cells[3]),
      epsEstimate: parseNullableNumber(cells[4]),
      reportedEps: parseNullableNumber(cells[5]),
      surprisePercent: parseNullableNumber(cells[6]),
      marketCap: emptyToNull(cells[7])
    };
  });

  return {
    title: document.title,
    rangeLabel,
    selectedDayLabel,
    rowCount: rows.length,
    rows
  };

  function compactText(value) {
    return String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function emptyToNull(value) {
    if (!value || value === "-") {
      return null;
    }
    return value;
  }

  function parseNullableNumber(value) {
    if (!value || value === "-") {
      return null;
    }

    const normalized = value.replace(/[$,%]/g, "").replace(/,/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
}

function printTable(result) {
  console.log(result.title);
  console.log(result.rangeLabel ?? `${result.requested.from} - ${result.requested.to}`);
  console.log(result.selectedDayLabel ?? `Earnings On ${result.requested.day}`);
  console.log("");

  console.table(
    result.rows.map((row) => ({
      Symbol: row.symbol,
      Company: row.companyName,
      Event: row.eventName ?? "-",
      Time: row.earningsCallTime ?? "-",
      "EPS Est.": row.epsEstimate ?? "-",
      "Reported EPS": row.reportedEps ?? "-",
      "Surprise %": row.surprisePercent ?? "-",
      "Market Cap": row.marketCap ?? "-"
    }))
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const result = await scrapeYahooEarningsCalendar(args);
  if (args.format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printTable(result);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Failed to scrape Yahoo earnings calendar: ${error.message}`);
    process.exitCode = 1;
  });
}
