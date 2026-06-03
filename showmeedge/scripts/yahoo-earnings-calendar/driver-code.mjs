#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";

const DEFAULT_FROM = "2026-04-05";
const DEFAULT_TO = "2026-04-11";
// const DEFAULT_DAY = "2026-04-07";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";


  // ----------------------------------------------------
function parseArgs(argv) {
  const args = {
    from: DEFAULT_FROM,
    to: DEFAULT_TO,
    //day: DEFAULT_DAY,
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
    } /* else if (arg === "--day") {
      args.day = requiredValue(arg, next);
      index += 1;
    }*/ else if (arg === "--timeout-ms") {
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

// ------------------------
function requiredValue(flag, value) {
  if (value == null || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

// ------------------------
function validateArgs(args) {
  for (const key of ["from", "to"]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args[key])) {
      throw new Error(`--${key} must be in YYYY-MM-DD format`);
    }
  }

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error("--timeout-ms must be a positive number");
  }
}

// ------------------------
function printHelp() {
  console.log(`Usage:
  node scripts/yahoo-earnings-calendar/driver-code.mjs [options]

Options:
  --from YYYY-MM-DD       Calendar range start. Default: ${DEFAULT_FROM}
  --to YYYY-MM-DD         Calendar range end. Default: ${DEFAULT_TO}
  --timeout-ms NUMBER     Page timeout in milliseconds. Default: ${DEFAULT_TIMEOUT_MS}
  --headful               Show the browser window instead of running headless
  --help                  Show this help text

Prints a JSON array of dates in the carousel that have earnings.
`);
}

// ----------------------------------------------------
function buildYahooEarningsUrl({ from, to, day, offset, size }) {
  const url = new URL("https://finance.yahoo.com/calendar/earnings");
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);

  if (day) {
    url.searchParams.set("day", day);
  }

  if (offset != null) {
    url.searchParams.set("offset", String(offset));
  }

  if (size != null) {
    url.searchParams.set("size", String(size));
  }

  return url.toString();
}

// ----------------------------------------------------
export async function scrapeYahooEarningsCalendar(options = {}) {
  const args = {
    from: options.from ?? DEFAULT_FROM,
    to: options.to ?? DEFAULT_TO,
    //day: options.day ?? DEFAULT_FROM,   // day is set to _FROM which is Sunday in the  From/TO range ...
    headless: options.headless ?? true,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  };
  validateArgs(args);

  const url = buildYahooEarningsUrl(args);
  const browser = await chromium.launch({ headless: args.headless });

  try {
    const page = await browser.newPage({
      userAgent: DEFAULT_USER_AGENT,
      viewport: { width: 1280, height: 720 }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: args.timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await page.waitForFunction(hasEarningsDateCarousel, null, { timeout: args.timeoutMs });

    const earningsDates = await page.evaluate(extractEarningsDateCarousel);

    // --------------------
    // Map and flatten the URLs based on earningsCount chunks of 100
    const urlarray = earningsDates.flatMap((item) => {
      const urlsForDay = [];
      const count = item.earningsCount;
      
      // If count is 0, you might want to skip it entirely.
      if (count === 0) return urlsForDay; 

      // Loop through counts in increments of 100
      for (let offset = 0; offset < count; offset += 100) {
        urlsForDay.push(
          buildYahooEarningsUrl({
            from: args.from,
            to: args.to,
            day: item.date,
            offset,
            size: 100
          })
        );
      }
      
      return urlsForDay;
    });

    return {  
      url,
      requested: {
        from: args.from,
        to: args.to,
        //day: args.day
      },
      earningsDates,
      urlarray : urlarray

    };
  } finally {
    await browser.close();
  } // end urlarray


} // end of scrapeYahooEarningsCalendar()

// ----------------------------------------------------
function hasEarningsDateCarousel() {
  return Array.from(document.querySelectorAll('[data-testid="carousel-container"]')).some((carousel) =>
    carousel.querySelector('[data-testid="calendar-event-pill"]')
  );
}

// ----------------------------------------------------
function extractEarningsDateCarousel() {
  const carousel = Array.from(document.querySelectorAll('[data-testid="carousel-container"]')).find((candidate) =>
    candidate.querySelector('[data-testid="calendar-event-pill"]')
  );

  if (!carousel) {
    throw new Error('Could not find Yahoo earnings date carousel: [data-testid="carousel-container"]');
  }

  return Array.from(carousel.querySelectorAll('[data-testid="calendar-event-pill"]'))
    .map((pill) => {
      const label = compactText(pill.querySelector("header")?.innerText);
      const earningsLink = Array.from(pill.querySelectorAll("a")).find((link) => {
        const linkText = compactText(link.innerText || link.textContent);
        const ariaLabel = link.getAttribute("aria-label") ?? "";
        const title = link.getAttribute("title") ?? "";
        return /Earnings/i.test(`${linkText} ${ariaLabel} ${title}`);
      });

      if (!earningsLink) {
        return null;
      }

      const text = compactText(earningsLink.innerText || earningsLink.textContent);
      const href = earningsLink.getAttribute("href");
      const date = getDayFromHref(href);
      const earningsCount = parseEarningsCount(text);

      return {
        date,
        label,
        text,
        earningsCount
      };
    })
    .filter(Boolean);

  function getDayFromHref(href) {
    if (!href) {
      return null;
    }

    try {
      return new URL(href, window.location.href).searchParams.get("day");
    } catch {
      return null;
    }
  }

  function parseEarningsCount(text) {
    const match = text.match(/(\d+)\s+Earnings?/i);
    if (!match) {
      return null;
    }

    const count = Number(match[1]);
    return Number.isFinite(count) ? count : null;
  }

  function compactText(value) {
    return String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
} // ------------- end ()

/**
 * Splits a date range into full Sunday-to-Saturday pairs.
 * Dynamically shifts the start date forward to the first Sunday,
 * and always runs the final week to its full Saturday.
 * * @param {string} startDateStr - The start date in YYYY-MM-DD format.
 * @param {string} endDateStr - The end date in YYYY-MM-DD format.
 * @returns {Array<Array<string>>} An array of [Sunday, Saturday] date pairs.
 */
function getStrictSundayToSaturdayPairs(startDateStr, endDateStr) {
    let start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');

    // Rule 1: Move start date forward until we hit the first Sunday (0 = Sunday)
    while (start.getDay() !== 0) {
        start.setDate(start.getDate() + 1);
    }
    
    // If our shifted Sunday is past the end date, we return an empty array
    if (start > end) return [];

    const pairs = [];
    let currentLeft = new Date(start);

    // Helper to format Date object to YYYY-MM-DD
    const formatDate = (date) => date.toISOString().split('T')[0];

    // Loop until we have processed a week that includes or surpasses the end date
    while (currentLeft <= end) {
        // Since currentLeft is guaranteed to be a Sunday, Saturday is always +6 days
        let currentRight = new Date(currentLeft);
        currentRight.setDate(currentLeft.getDate() + 6);

        // Rule 2: No capping. We push the full [Sunday, Saturday] pair as-is.
        pairs.push([formatDate(currentLeft), formatDate(currentRight)]);

        // Move to the next Sunday
        currentLeft = new Date(currentRight);
        currentLeft.setDate(currentRight.getDate() + 1);
    }

    return pairs;
}

// ==========================================
// TEST CODE AND EXECUTION
// ==========================================

function runTests() {
    const testCases = [
        {
            name: "Mid-week start to mid-week end (Moves start to Sunday, overflows end Saturday)",
            start: "2026-05-13", // Wednesday -> Will shift to Sun May 17
            end: "2026-05-28"    // Thursday  -> Last pair will run to Sat May 30
        },
        {
            name: "Already starts on Sunday, ends mid-week (Overflows end Saturday)",
            start: "2026-05-10", // Sunday
            end: "2026-05-15"    // Friday    -> Last pair will run to Sat May 16
        }
    ];

    testCases.forEach((test, index) => {
        console.log(`--- Test ${index + 1}: ${test.name} ---`);
        console.log(`Input Range: ${test.start} to ${test.end}`);
        
        const result = getStrictSundayToSaturdayPairs(test.start, test.end);
        
        console.log("Result:");
        console.log(JSON.stringify(result, null, 2));
        console.log("\n");
    });
}
// runTests();    --- Testrun commeneted ..


// ---*************************************************** -------------------------------------------------
// sample run from Terminal Command line  , this should give pagination urls ..
//https://finance.yahoo.com/calendar/earnings?from=2026-04-19&to=2026-04-25&day=2026-04-23

// node scripts/yahoo-earnings-calendar/driver-code.mjs --from 2026-04-19 --to 2026-04-25  




// ---------------------- main()   --------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const datePairsArray = getStrictSundayToSaturdayPairs(args.from, args.to);
  const results = [];

  for (const item of datePairsArray) {
    const result = await scrapeYahooEarningsCalendar({
      from: item[0],
      to: item[1],
      headless: args.headless,
      timeoutMs: args.timeoutMs
    });
    results.push(result);
  }

  console.log(JSON.stringify(results, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Failed to scrape Yahoo earnings calendar: ${error.message}`);
    process.exitCode = 1;
  });
}
