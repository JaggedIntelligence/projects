import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const tickers = (await fs.readFile("tickers.txt", "utf8"))
  .split(/\r?\n/)
  .map(x => x.trim().toLowerCase())
  .filter(Boolean);

const outDir = path.resolve("tipranks-output");
const profileDir = path.join(os.homedir(), ".tipranks-playwright-profile");

await fs.mkdir(outDir, { recursive: true });

const context = await chromium.launchPersistentContext(profileDir, {
  channel: "chrome",
  headless: false,
  acceptDownloads: true,
  viewport: { width: 1440, height: 1100 },
});

const page = await context.newPage();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(minSeconds, maxSeconds) {
  const ms = (minSeconds + Math.random() * (maxSeconds - minSeconds)) * 1000;
  return sleep(ms);
}

for (const ticker of tickers) {
  const dir = path.join(outDir, ticker.toUpperCase());
  await fs.mkdir(dir, { recursive: true });

  const url = `https://www.tipranks.com/stocks/${ticker}/forecast`;
  console.log(`Opening ${url}`);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    await page.getByText(/Stock Forecast|Analyst Ratings|Detailed List/i).waitFor({
      timeout: 90000,
    });

    const bodyText = await page.locator("body").innerText();

    if (/captcha|are you a robot|access denied|too many requests/i.test(bodyText)) {
      throw new Error("TipRanks showed a challenge/rate-limit page. Stopping.");
    }

    await page.screenshot({
      path: path.join(dir, `${ticker}-forecast.png`),
      fullPage: true,
    });

    await fs.writeFile(
      path.join(dir, `${ticker}-forecast.html`),
      await page.content(),
      "utf8"
    );

    await fs.writeFile(
      path.join(dir, `${ticker}-forecast.txt`),
      bodyText,
      "utf8"
    );

    const cdp = await context.newCDPSession(page);
    const snapshot = await cdp.send("Page.captureSnapshot", { format: "mhtml" });
    await fs.writeFile(
      path.join(dir, `${ticker}-forecast.mhtml`),
      snapshot.data,
      "utf8"
    );

    const csvButton = page.getByText("Download CSV", { exact: true });

    if (await csvButton.isVisible().catch(() => false)) {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 30000 }),
        csvButton.click(),
      ]);

      await download.saveAs(path.join(dir, `${ticker}-forecast.csv`));
      console.log(`Saved CSV for ${ticker.toUpperCase()}`);
    } else {
      console.log(`No CSV button visible for ${ticker.toUpperCase()}`);
    }

    await randomDelay(45, 120);
  } catch (err) {
    console.error(`Failed on ${ticker.toUpperCase()}: ${err.message}`);
    await fs.writeFile(
      path.join(dir, `${ticker}-error.txt`),
      String(err.stack || err),
      "utf8"
    );
    break;
  }
}

await context.close();