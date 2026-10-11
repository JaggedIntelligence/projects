
// scripts/save-tipranks-auth.mjs
import { chromium } from "@playwright/test";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const AUTH_FILE = "tipranks-auth.json";

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto("https://www.tipranks.com/login", {
  waitUntil: "domcontentloaded",
});

console.log("Log in manually, then return here.");

const rl = createInterface({ input, output });
await rl.question("Press Enter after login is complete...");
rl.close();

await context.storageState({ path: AUTH_FILE });
await browser.close();

console.log(`Saved auth to ${AUTH_FILE}`);
