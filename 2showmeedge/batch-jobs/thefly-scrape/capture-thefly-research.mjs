#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

const DEFAULTS = Object.freeze({
  url: "https://www.thefly.com/research",
  outputDir: path.join(SCRIPT_DIR, "captures"),
  profileDir: path.join(SCRIPT_DIR, ".browser-profile"),
  browser: "chrome",
  headless: false,
  readySelector: "body",
  readyText: "Research",
  itemSelector: "",
  scrollSelector: "",
  scroll: true,
  saveScrollSnapshots: false,
  navigationTimeoutMs: 120_000,
  loginTimeoutMs: 300_000,
  readyTimeoutMs: 120_000,
  settleTimeoutMs: 45_000,
  sampleIntervalMs: 1_000,
  stableSamples: 4,
  scrollDelayMs: 750,
  maxScrollSteps: 80,
  minHtmlBytes: 5_000,
  minTextChars: 500,
  minItems: 0,
});

const LOGIN_URL_PATTERN = /\/(?:login|log-in|signin|sign-in|account\/login)(?:[/?#]|$)/i;
const LOGIN_TEXT_PATTERN =
  /(?:sign|log)\s+in\s+to\s+(?:continue|your\s+account|view)|enter\s+your\s+(?:email|password)|email\s+address[\s\S]{0,300}password/i;
const CHALLENGE_TEXT_PATTERN =
  /verify\s+you\s+are\s+(?:a\s+)?human|are\s+you\s+a\s+robot|access\s+denied|unusual\s+traffic|too\s+many\s+requests|captcha|cloudflare\s+ray\s+id/i;
const STREET_RESEARCH_LOCK_PATTERN =
  /subscribe\s+to\s+unlock\s+street\s+research|get\s+the\s+fly\s+pro\s+\d+\s+days?\s+for\s+free/i;

const options = parseArguments(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

validateOptions(options);
await runCapture(options);

async function runCapture(config) {
  const capturedAt = new Date();
  const runName = toFilesystemTimestamp(capturedAt);
  const runDir = path.join(config.outputDir, runName);
  const scrollSnapshotDir = path.join(runDir, "scroll-snapshots");

  await fs.mkdir(runDir, { recursive: true, mode: 0o700 });
  await fs.mkdir(config.profileDir, { recursive: true, mode: 0o700 });

  let context;
  let page;
  let navigationStatus = null;
  let success = false;

  try {
    context = await launchPersistentContext(config);
    page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(config.readyTimeoutMs);
    page.setDefaultNavigationTimeout(config.navigationTimeoutMs);

    console.log(`Opening ${config.url}`);
    const response = await page.goto(config.url, {
      waitUntil: "domcontentloaded",
      timeout: config.navigationTimeoutMs,
    });
    navigationStatus = response?.status() ?? null;

    await waitForAuthentication(page, config);
    await ensureTargetPage(page, config);
    await waitForReadyContent(page, config);

    const collectedItems = new Map();
    const scrollResult = config.scroll
      ? await loadLazyContent(page, config, {
          collectedItems,
          scrollSnapshotDir,
        })
      : {
          enabled: false,
          steps: 0,
          reachedBottom: null,
          hitStepLimit: false,
        };

    if (config.itemSelector) {
      await collectRenderedItems(page, config.itemSelector, collectedItems);
    }

    const stability = await waitForDomStability(page, config);
    if (!stability.stable) {
      console.warn(
        `Warning: DOM did not become stable within ${config.settleTimeoutMs}ms; capturing the latest state.`,
      );
    }

    const html = ensureDoctype(await page.content());
    const finalState = await inspectPage(page, config);
    const validation = validateCapture({
      config,
      html,
      finalState,
      collectedItemCount: collectedItems.size,
    });

    const htmlPath = path.join(runDir, "final-dom.html");
    const screenshotPath = path.join(runDir, "final-page.png");
    const metadataPath = path.join(runDir, "capture-metadata.json");

    let screenshotError = null;
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await fs.chmod(screenshotPath, 0o600);
    } catch (error) {
      screenshotError = errorMessage(error);
      console.warn(`Warning: could not save the full-page screenshot: ${screenshotError}`);
    }

    if (!validation.passed) {
      await atomicWrite(path.join(runDir, "failed-dom.html"), html);
      await atomicWrite(
        path.join(runDir, "capture-failure.json"),
        JSON.stringify(
          {
            capturedAt: capturedAt.toISOString(),
            requestedUrl: config.url,
            navigationStatus,
            validation,
            finalState: publicPageState(finalState),
            screenshotError,
          },
          null,
          2,
        ),
      );
      throw new Error(`Capture validation failed: ${validation.failures.join("; ")}`);
    }

    await atomicWrite(htmlPath, html);

    let collectedItemsPath = null;
    if (config.itemSelector && collectedItems.size > 0) {
      collectedItemsPath = path.join(runDir, "collected-items.html");
      await atomicWrite(
        collectedItemsPath,
        buildCollectedItemsDocument(config.url, config.itemSelector, collectedItems),
      );
    }

    const metadata = {
      capturedAt: capturedAt.toISOString(),
      requestedUrl: config.url,
      finalUrl: finalState.url,
      title: finalState.title,
      navigationStatus,
      htmlBytes: Buffer.byteLength(html, "utf8"),
      htmlSha256: sha256(html),
      textCharacters: finalState.bodyTextLength,
      elementCount: finalState.elementCount,
      readySelector: config.readySelector,
      readySelectorCount: finalState.readySelectorCount,
      readyText: config.readyText || null,
      readyTextPresent: finalState.readyTextPresent,
      itemSelector: config.itemSelector || null,
      collectedItemCount: config.itemSelector ? collectedItems.size : null,
      scroll: scrollResult,
      stability,
      screenshotSaved: screenshotError === null,
      screenshotError,
      validation,
      files: {
        html: path.basename(htmlPath),
        screenshot: screenshotError === null ? path.basename(screenshotPath) : null,
        collectedItems: collectedItemsPath ? path.basename(collectedItemsPath) : null,
      },
    };

    await atomicWrite(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
    success = true;

    console.log(`Saved rendered HTML: ${htmlPath}`);
    console.log(
      `Captured ${metadata.htmlBytes.toLocaleString()} bytes and ${metadata.textCharacters.toLocaleString()} visible-text characters.`,
    );
    if (collectedItemsPath) {
      console.log(
        `Saved ${collectedItems.size.toLocaleString()} unique rendered item fragments: ${collectedItemsPath}`,
      );
    }
  } catch (error) {
    console.error(`Capture failed: ${errorMessage(error)}`);
    if (page && !page.isClosed()) {
      await saveFailureDiagnostics(page, runDir, config, error).catch((diagnosticError) => {
        console.error(`Could not save failure diagnostics: ${errorMessage(diagnosticError)}`);
      });
    }
    process.exitCode = 1;
  } finally {
    await context?.close().catch(() => {});
    if (!success) {
      console.error(`Failure artifacts, when available, are in ${runDir}`);
    }
  }
}

async function launchPersistentContext(config) {
  const launchOptions = {
    headless: config.headless,
    viewport: { width: 1440, height: 1100 },
    acceptDownloads: false,
    args: ["--disable-notifications"],
  };

  if (config.browser === "chrome") {
    launchOptions.channel = "chrome";
  }

  console.log(
    `Starting ${config.browser} in ${config.headless ? "headless" : "visible"} mode with profile ${config.profileDir}`,
  );

  return chromium.launchPersistentContext(config.profileDir, launchOptions);
}

async function waitForAuthentication(page, config) {
  let state = await inspectPage(page, config);

  if (state.possibleChallenge) {
    throw new Error("The page appears to be a CAPTCHA, challenge, or access-denied page.");
  }

  if (!state.possibleLogin && !state.restrictedContent) {
    return;
  }

  if (config.headless) {
    throw new Error(
      "The browser profile is signed out or lacks Street Research access. Run without --headless and sign in with an account that can access Street Research.",
    );
  }

  console.log(
    `Street Research is locked or login is required. Sign in with an account that can access Street Research; waiting up to ${Math.round(
      config.loginTimeoutMs / 60_000,
    )} minutes.`,
  );

  const deadline = Date.now() + config.loginTimeoutMs;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1_500);
    state = await inspectPage(page, config);

    if (state.possibleChallenge) {
      throw new Error("A CAPTCHA, challenge, or access-denied page appeared during login.");
    }

    if (!state.possibleLogin && !state.restrictedContent) {
      console.log("Street Research access is now available; continuing capture.");
      return;
    }
  }

  throw new Error(
    "Timed out waiting for login with an account that can access Street Research.",
  );
}

async function ensureTargetPage(page, config) {
  if (isExpectedTargetUrl(page.url(), config.url)) {
    return;
  }

  console.log(`Returning to ${config.url} after authentication.`);
  await page.goto(config.url, {
    waitUntil: "domcontentloaded",
    timeout: config.navigationTimeoutMs,
  });

  const state = await inspectPage(page, config);
  if (state.possibleLogin || state.restrictedContent) {
    throw new Error(
      "The target page is still signed out or restricted after authentication.",
    );
  }
  if (state.possibleChallenge) {
    throw new Error("The target page returned a CAPTCHA, challenge, or access-denied page.");
  }
}

async function waitForReadyContent(page, config) {
  await page.locator(config.readySelector).waitFor({
    state: "visible",
    timeout: config.readyTimeoutMs,
  });

  if (config.readyText) {
    await page.waitForFunction(
      (text) => (document.body?.innerText ?? "").includes(text),
      config.readyText,
      { timeout: config.readyTimeoutMs },
    );
  }

  const state = await inspectPage(page, config);
  if (state.possibleLogin || state.restrictedContent) {
    throw new Error(
      "Street Research is still locked while waiting for research content.",
    );
  }
  if (state.possibleChallenge) {
    throw new Error("A CAPTCHA, challenge, or access-denied page was detected.");
  }

  console.log("Expected page content is visible.");
}

async function loadLazyContent(page, config, { collectedItems, scrollSnapshotDir }) {
  console.log("Scrolling to trigger lazy-loaded content.");

  if (config.saveScrollSnapshots) {
    await fs.mkdir(scrollSnapshotDir, { recursive: true, mode: 0o700 });
  }

  await resetScrollPosition(page, config.scrollSelector);
  let lastScrollHeight = -1;
  let stableBottomChecks = 0;
  let reachedBottom = false;
  let steps = 0;

  for (steps = 0; steps < config.maxScrollSteps; steps += 1) {
    if (config.itemSelector) {
      await collectRenderedItems(page, config.itemSelector, collectedItems);
    }

    if (config.saveScrollSnapshots) {
      const snapshot = ensureDoctype(await page.content());
      await atomicWrite(
        path.join(scrollSnapshotDir, `scroll-${String(steps).padStart(3, "0")}.html`),
        snapshot,
      );
    }

    await scrollOneStep(page, config.scrollSelector);
    await page.waitForTimeout(config.scrollDelayMs);
    const scrollState = await getScrollState(page, config.scrollSelector);

    if (scrollState.atBottom) {
      if (scrollState.scrollHeight === lastScrollHeight) {
        stableBottomChecks += 1;
      } else {
        stableBottomChecks = 1;
      }

      if (stableBottomChecks >= 3) {
        reachedBottom = true;
        steps += 1;
        break;
      }
    } else {
      stableBottomChecks = 0;
    }

    lastScrollHeight = scrollState.scrollHeight;
  }

  if (config.itemSelector) {
    await collectRenderedItems(page, config.itemSelector, collectedItems);
  }

  const hitStepLimit = !reachedBottom && steps >= config.maxScrollSteps;
  if (hitStepLimit) {
    console.warn(
      `Warning: stopped scrolling after ${config.maxScrollSteps} steps before a stable bottom was detected.`,
    );
  } else {
    console.log(`Lazy-load scrolling finished after ${steps} steps.`);
  }

  return {
    enabled: true,
    selector: config.scrollSelector || null,
    steps,
    reachedBottom,
    hitStepLimit,
    snapshotsSaved: config.saveScrollSnapshots,
  };
}

async function resetScrollPosition(page, selector) {
  if (selector) {
    await page.locator(selector).evaluate((element) => {
      element.scrollTop = 0;
    });
    return;
  }

  await page.evaluate(() => window.scrollTo(0, 0));
}

async function scrollOneStep(page, selector) {
  if (selector) {
    await page.locator(selector).evaluate((element) => {
      const step = Math.max(400, Math.floor(element.clientHeight * 0.8));
      element.scrollTop += step;
    });
    return;
  }

  await page.evaluate(() => {
    const step = Math.max(400, Math.floor(window.innerHeight * 0.8));
    window.scrollBy(0, step);
  });
}

async function getScrollState(page, selector) {
  if (selector) {
    return page.locator(selector).evaluate((element) => ({
      scrollTop: element.scrollTop,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      atBottom: element.scrollTop + element.clientHeight >= element.scrollHeight - 4,
    }));
  }

  return page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return {
      scrollTop: root.scrollTop,
      clientHeight: window.innerHeight,
      scrollHeight: root.scrollHeight,
      atBottom: root.scrollTop + window.innerHeight >= root.scrollHeight - 4,
    };
  });
}

async function collectRenderedItems(page, selector, collectedItems) {
  const fragments = await page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => element.outerHTML),
  );

  for (const fragment of fragments) {
    collectedItems.set(sha256(fragment), fragment);
  }
}

async function waitForDomStability(page, config) {
  console.log("Waiting for the rendered DOM to settle.");
  const deadline = Date.now() + config.settleTimeoutMs;
  let previous = null;
  let consecutiveStableSamples = 0;
  let samples = 0;
  let latest = null;

  while (Date.now() < deadline) {
    latest = await measureDom(page);
    samples += 1;

    if (previous && domMetricsAreClose(previous, latest)) {
      consecutiveStableSamples += 1;
      if (consecutiveStableSamples >= config.stableSamples) {
        return {
          stable: true,
          samples,
          consecutiveStableSamples,
          finalMetrics: latest,
        };
      }
    } else {
      consecutiveStableSamples = 0;
    }

    previous = latest;
    await page.waitForTimeout(config.sampleIntervalMs);
  }

  return {
    stable: false,
    samples,
    consecutiveStableSamples,
    finalMetrics: latest,
  };
}

async function measureDom(page) {
  return page.evaluate(() => ({
    htmlCharacters: document.documentElement?.outerHTML.length ?? 0,
    bodyTextCharacters: document.body?.innerText.length ?? 0,
    elementCount: document.body?.getElementsByTagName("*").length ?? 0,
    scrollHeight: document.scrollingElement?.scrollHeight ?? document.documentElement.scrollHeight,
  }));
}

function domMetricsAreClose(previous, current) {
  return (
    withinTolerance(previous.htmlCharacters, current.htmlCharacters, 200, 0.005) &&
    withinTolerance(previous.bodyTextCharacters, current.bodyTextCharacters, 50, 0.005) &&
    withinTolerance(previous.elementCount, current.elementCount, 3, 0.005) &&
    Math.abs(previous.scrollHeight - current.scrollHeight) <= 4
  );
}

function withinTolerance(a, b, absoluteTolerance, fractionalTolerance) {
  const tolerance = Math.max(absoluteTolerance, Math.max(a, b) * fractionalTolerance);
  return Math.abs(a - b) <= tolerance;
}

async function inspectPage(page, config) {
  const browserState = await page.evaluate(
    ({ readySelector, readyText }) => {
      const bodyText = document.body?.innerText ?? "";
      return {
        url: window.location.href,
        title: document.title,
        bodyTextLength: bodyText.length,
        bodyTextSample: bodyText.slice(0, 100_000),
        elementCount: document.body?.getElementsByTagName("*").length ?? 0,
        readySelectorCount: document.querySelectorAll(readySelector).length,
        readyTextPresent: readyText ? bodyText.includes(readyText) : true,
        anonymousSignInPresent: Boolean(
          document.querySelector('[aria-label="Sign in"], button[data-testid*="sign-in"]'),
        ),
        planValues: Array.from(document.querySelectorAll("[data-plan]"))
          .map((element) => element.getAttribute("data-plan"))
          .filter(Boolean),
      };
    },
    { readySelector: config.readySelector, readyText: config.readyText },
  );

  return {
    ...browserState,
    possibleLogin:
      LOGIN_URL_PATTERN.test(browserState.url) ||
      browserState.anonymousSignInPresent ||
      (browserState.bodyTextLength < 50_000 &&
        LOGIN_TEXT_PATTERN.test(browserState.bodyTextSample.slice(0, 10_000))),
    restrictedContent:
      browserState.planValues.includes("free") ||
      STREET_RESEARCH_LOCK_PATTERN.test(browserState.bodyTextSample.slice(0, 20_000)),
    possibleChallenge:
      browserState.bodyTextLength < 50_000 &&
      CHALLENGE_TEXT_PATTERN.test(
        `${browserState.title}\n${browserState.bodyTextSample.slice(0, 10_000)}`,
      ),
  };
}

function validateCapture({ config, html, finalState, collectedItemCount }) {
  const htmlBytes = Buffer.byteLength(html, "utf8");
  const checks = {
    expectedTargetUrl: isExpectedTargetUrl(finalState.url, config.url),
    minimumHtmlBytes: htmlBytes >= config.minHtmlBytes,
    minimumVisibleText: finalState.bodyTextLength >= config.minTextChars,
    readySelectorPresent: finalState.readySelectorCount > 0,
    readyTextPresent: finalState.readyTextPresent,
    notLoginPage: !finalState.possibleLogin,
    streetResearchUnlocked: !finalState.restrictedContent,
    notChallengePage: !finalState.possibleChallenge,
    minimumCollectedItems:
      !config.itemSelector || collectedItemCount >= config.minItems,
  };

  const failures = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  return {
    passed: failures.length === 0,
    checks,
    failures,
  };
}

async function saveFailureDiagnostics(page, runDir, config, error) {
  const diagnostic = {
    capturedAt: new Date().toISOString(),
    requestedUrl: config.url,
    error: errorMessage(error),
  };

  try {
    const state = await inspectPage(page, config);
    diagnostic.page = publicPageState(state);
  } catch (inspectionError) {
    diagnostic.inspectionError = errorMessage(inspectionError);
  }

  try {
    const html = ensureDoctype(await page.content());
    await atomicWrite(path.join(runDir, "failure-page.html"), html);
  } catch (htmlError) {
    diagnostic.htmlError = errorMessage(htmlError);
  }

  try {
    const screenshotPath = path.join(runDir, "failure-page.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await fs.chmod(screenshotPath, 0o600);
  } catch (screenshotError) {
    diagnostic.screenshotError = errorMessage(screenshotError);
  }

  await atomicWrite(
    path.join(runDir, "failure-metadata.json"),
    `${JSON.stringify(diagnostic, null, 2)}\n`,
  );
}

function publicPageState(state) {
  const { bodyTextSample: _privateText, ...publicState } = state;
  return publicState;
}

function buildCollectedItemsDocument(url, selector, collectedItems) {
  const items = [...collectedItems.values()].join("\n\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <base href="${escapeHtmlAttribute(url)}">
  <meta name="thefly-source-url" content="${escapeHtmlAttribute(url)}">
  <meta name="thefly-item-selector" content="${escapeHtmlAttribute(selector)}">
  <title>Collected rendered items from TheFly Research</title>
</head>
<body>
${items}
</body>
</html>
`;
}

async function atomicWrite(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporaryPath, contents, { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporaryPath, filePath);
}

function isExpectedTargetUrl(actual, requested) {
  try {
    const actualUrl = new URL(actual);
    const requestedUrl = new URL(requested);
    return (
      normalizeHostname(actualUrl.hostname) === normalizeHostname(requestedUrl.hostname) &&
      normalizePathname(actualUrl.pathname) === normalizePathname(requestedUrl.pathname)
    );
  } catch {
    return false;
  }
}

function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function normalizePathname(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function ensureDoctype(html) {
  return /^\s*<!doctype\s+html/i.test(html) ? html : `<!doctype html>\n${html}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function toFilesystemTimestamp(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function parseArguments(args) {
  const parsed = { ...DEFAULTS, help: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    switch (argument) {
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      case "--headless":
        parsed.headless = true;
        break;
      case "--headed":
        parsed.headless = false;
        break;
      case "--no-scroll":
        parsed.scroll = false;
        break;
      case "--save-scroll-snapshots":
        parsed.saveScrollSnapshots = true;
        break;
      case "--url":
        parsed.url = nextValue(args, ++index, argument);
        break;
      case "--output-dir":
        parsed.outputDir = path.resolve(nextValue(args, ++index, argument));
        break;
      case "--profile-dir":
        parsed.profileDir = path.resolve(nextValue(args, ++index, argument));
        break;
      case "--browser":
        parsed.browser = nextValue(args, ++index, argument);
        break;
      case "--ready-selector":
        parsed.readySelector = nextValue(args, ++index, argument);
        break;
      case "--ready-text":
        parsed.readyText = nextValue(args, ++index, argument);
        break;
      case "--no-ready-text":
        parsed.readyText = "";
        break;
      case "--item-selector":
        parsed.itemSelector = nextValue(args, ++index, argument);
        break;
      case "--scroll-selector":
        parsed.scrollSelector = nextValue(args, ++index, argument);
        break;
      case "--navigation-timeout-ms":
        parsed.navigationTimeoutMs = parseInteger(nextValue(args, ++index, argument), argument);
        break;
      case "--login-timeout-ms":
        parsed.loginTimeoutMs = parseInteger(nextValue(args, ++index, argument), argument);
        break;
      case "--ready-timeout-ms":
        parsed.readyTimeoutMs = parseInteger(nextValue(args, ++index, argument), argument);
        break;
      case "--settle-timeout-ms":
        parsed.settleTimeoutMs = parseInteger(nextValue(args, ++index, argument), argument);
        break;
      case "--sample-interval-ms":
        parsed.sampleIntervalMs = parseInteger(nextValue(args, ++index, argument), argument);
        break;
      case "--stable-samples":
        parsed.stableSamples = parseInteger(nextValue(args, ++index, argument), argument);
        break;
      case "--scroll-delay-ms":
        parsed.scrollDelayMs = parseInteger(nextValue(args, ++index, argument), argument);
        break;
      case "--max-scroll-steps":
        parsed.maxScrollSteps = parseInteger(nextValue(args, ++index, argument), argument);
        break;
      case "--min-html-bytes":
        parsed.minHtmlBytes = parseInteger(nextValue(args, ++index, argument), argument);
        break;
      case "--min-text-chars":
        parsed.minTextChars = parseInteger(nextValue(args, ++index, argument), argument);
        break;
      case "--min-items":
        parsed.minItems = parseInteger(nextValue(args, ++index, argument), argument);
        break;
      default:
        throw new Error(`Unknown argument: ${argument}. Run with --help for usage.`);
    }
  }

  return parsed;
}

function validateOptions(config) {
  let target;
  try {
    target = new URL(config.url);
  } catch {
    throw new Error(`Invalid --url value: ${config.url}`);
  }

  if (target.protocol !== "https:") {
    throw new Error("The target URL must use HTTPS.");
  }

  if (target.hostname !== "thefly.com" && !target.hostname.endsWith(".thefly.com")) {
    throw new Error("This job only accepts thefly.com target URLs.");
  }

  if (!["chrome", "chromium"].includes(config.browser)) {
    throw new Error("--browser must be either chrome or chromium.");
  }

  const positiveIntegers = {
    navigationTimeoutMs: config.navigationTimeoutMs,
    loginTimeoutMs: config.loginTimeoutMs,
    readyTimeoutMs: config.readyTimeoutMs,
    settleTimeoutMs: config.settleTimeoutMs,
    sampleIntervalMs: config.sampleIntervalMs,
    stableSamples: config.stableSamples,
    maxScrollSteps: config.maxScrollSteps,
  };

  for (const [name, value] of Object.entries(positiveIntegers)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${name} must be a positive integer.`);
    }
  }

  const nonNegativeIntegers = {
    scrollDelayMs: config.scrollDelayMs,
    minHtmlBytes: config.minHtmlBytes,
    minTextChars: config.minTextChars,
    minItems: config.minItems,
  };

  for (const [name, value] of Object.entries(nonNegativeIntegers)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${name} must be a non-negative integer.`);
    }
  }

  if (!config.readySelector.trim()) {
    throw new Error("--ready-selector cannot be empty.");
  }

  if (config.minItems > 0 && !config.itemSelector) {
    throw new Error("--min-items requires --item-selector.");
  }
}

function nextValue(args, index, argument) {
  const value = args[index];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${argument} requires a value.`);
  }
  return value;
}

function parseInteger(value, argument) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${argument} requires an integer value.`);
  }
  return parsed;
}

function printHelp() {
  console.log(`TheFly rendered HTML capture

Usage:
  node capture-thefly-research.mjs [options]

Main options:
  --url <url>                    Target URL (default: ${DEFAULTS.url})
  --headed                       Show browser window (default)
  --headless                     Run without a visible browser
  --browser <chrome|chromium>    Browser channel (default: ${DEFAULTS.browser})
  --output-dir <path>            Capture directory (default: ${DEFAULTS.outputDir})
  --profile-dir <path>           Persistent profile (default: ${DEFAULTS.profileDir})
  --ready-selector <css>         Required visible element (default: ${DEFAULTS.readySelector})
  --ready-text <text>            Required visible body text (default: ${DEFAULTS.readyText})
  --no-ready-text                Disable the ready-text check

Lazy loading and virtual lists:
  --no-scroll                    Do not scroll the page before capture
  --scroll-selector <css>        Scroll this element instead of the page
  --max-scroll-steps <number>    Maximum lazy-load scroll steps (default: ${DEFAULTS.maxScrollSteps})
  --scroll-delay-ms <number>     Delay after each scroll (default: ${DEFAULTS.scrollDelayMs})
  --save-scroll-snapshots        Save HTML at every scroll position
  --item-selector <css>          Preserve unique matching item outerHTML while scrolling
  --min-items <number>           Fail if fewer unique items are preserved

Validation and timing:
  --navigation-timeout-ms <n>    Navigation timeout (default: ${DEFAULTS.navigationTimeoutMs})
  --login-timeout-ms <n>         Manual-login timeout (default: ${DEFAULTS.loginTimeoutMs})
  --ready-timeout-ms <n>         Ready-content timeout (default: ${DEFAULTS.readyTimeoutMs})
  --settle-timeout-ms <n>        DOM-settle timeout (default: ${DEFAULTS.settleTimeoutMs})
  --sample-interval-ms <n>       DOM-settle sampling interval (default: ${DEFAULTS.sampleIntervalMs})
  --stable-samples <n>           Consecutive stable samples required (default: ${DEFAULTS.stableSamples})
  --min-html-bytes <n>           Minimum saved HTML size (default: ${DEFAULTS.minHtmlBytes})
  --min-text-chars <n>           Minimum visible text length (default: ${DEFAULTS.minTextChars})
  -h, --help                     Show this help
`);
}
