
import { chromium } from "@playwright/test";

const AUTH_FILE = "tipranks-auth.json";
const URL = "https://www.tipranks.com/stocks/amd/forecast";

const browser = await chromium.launch({ headless: false });

const context = await browser.newContext({
  storageState: AUTH_FILE,
});

const page = await context.newPage();

await page.goto(URL, {
  waitUntil: "networkidle",
});

const tableRows = await page.locator("table tr").evaluateAll((rows) =>
  rows.map((row) =>
    Array.from(row.querySelectorAll("th, td")).map((cell) =>
      cell.textContent?.trim()
    )
  )
);

console.log(JSON.stringify(tableRows, null, 2));

await browser.close();
