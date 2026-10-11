const DEFAULT_SETTINGS = {
  tickers: "CBRS\nAMD\nSMCI\nAVGO\nZS",
  delaySeconds: 45,
  loadWaitSeconds: 15,
  outputFolder: "tipranks-html",
  expandShowMore: true,
  showMoreMaxClicks: 10,
  showMoreWaitSeconds: 3,
};

const els = {
  tickers: document.querySelector("#tickers"),
  delaySeconds: document.querySelector("#delaySeconds"),
  loadWaitSeconds: document.querySelector("#loadWaitSeconds"),
  outputFolder: document.querySelector("#outputFolder"),
  expandShowMore: document.querySelector("#expandShowMore"),
  showMoreMaxClicks: document.querySelector("#showMoreMaxClicks"),
  showMoreWaitSeconds: document.querySelector("#showMoreWaitSeconds"),
  startButton: document.querySelector("#startButton"),
  pauseButton: document.querySelector("#pauseButton"),
  stopButton: document.querySelector("#stopButton"),
  captureActiveButton: document.querySelector("#captureActiveButton"),
  clearLogButton: document.querySelector("#clearLogButton"),
  runState: document.querySelector("#runState"),
  progressLabel: document.querySelector("#progressLabel"),
  progressCount: document.querySelector("#progressCount"),
  progressBar: document.querySelector("#progressBar"),
  log: document.querySelector("#log"),
};

let targetTabId = null;
let running = false;
let paused = false;
let stopRequested = false;

init();

async function init() {
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  els.tickers.value = settings.tickers;
  els.delaySeconds.value = settings.delaySeconds;
  els.loadWaitSeconds.value = settings.loadWaitSeconds;
  els.outputFolder.value = settings.outputFolder;
  els.expandShowMore.checked = Boolean(settings.expandShowMore);
  els.showMoreMaxClicks.value = settings.showMoreMaxClicks;
  els.showMoreWaitSeconds.value = settings.showMoreWaitSeconds;

  for (const input of [
    els.tickers,
    els.delaySeconds,
    els.loadWaitSeconds,
    els.outputFolder,
    els.expandShowMore,
    els.showMoreMaxClicks,
    els.showMoreWaitSeconds,
  ]) {
    input.addEventListener("input", saveSettings);
    input.addEventListener("change", saveSettings);
  }

  els.startButton.addEventListener("click", startRun);
  els.pauseButton.addEventListener("click", togglePause);
  els.stopButton.addEventListener("click", requestStop);
  els.captureActiveButton.addEventListener("click", captureActiveTabOnce);
  els.clearLogButton.addEventListener("click", () => {
    els.log.textContent = "";
  });

  setRunState("Idle", "");
  updateControls();
  logLine("Ready. Log into TipRanks in Chrome first, then start the run.");
}

async function saveSettings() {
  await chrome.storage.local.set(readSettings());
}

function readSettings() {
  return {
    tickers: els.tickers.value,
    delaySeconds: clampNumber(els.delaySeconds.value, 5, 600, DEFAULT_SETTINGS.delaySeconds),
    loadWaitSeconds: clampNumber(
      els.loadWaitSeconds.value,
      3,
      120,
      DEFAULT_SETTINGS.loadWaitSeconds,
    ),
    outputFolder: sanitizeFolder(els.outputFolder.value || DEFAULT_SETTINGS.outputFolder),
    expandShowMore: els.expandShowMore.checked,
    showMoreMaxClicks: clampNumber(
      els.showMoreMaxClicks.value,
      0,
      50,
      DEFAULT_SETTINGS.showMoreMaxClicks,
    ),
    showMoreWaitSeconds: clampNumber(
      els.showMoreWaitSeconds.value,
      1,
      30,
      DEFAULT_SETTINGS.showMoreWaitSeconds,
    ),
  };
}

function parseTickers(input) {
  return Array.from(
    new Set(
      input
        .split(/[\s,;]+/)
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean)
        .map((ticker) => ticker.replace(/[^A-Z0-9.-]/g, "")),
    ),
  ).filter(Boolean);
}

async function startRun() {
  const settings = readSettings();
  const tickers = parseTickers(settings.tickers);

  if (tickers.length === 0) {
    logLine("No tickers found. Add at least one ticker.");
    return;
  }

  await saveSettings();

  running = true;
  paused = false;
  stopRequested = false;
  updateControls();
  setProgress("Starting", 0, tickers.length);
  logLine(`Starting run for ${tickers.length} ticker(s).`);

  try {
    targetTabId = await ensureTargetTab();

    for (let index = 0; index < tickers.length; index += 1) {
      if (stopRequested) {
        break;
      }

      await waitIfPaused();

      const ticker = tickers[index];
      setProgress(`Opening ${ticker}`, index, tickers.length);
      await captureTicker(ticker, settings);
      setProgress(`Saved ${ticker}`, index + 1, tickers.length);

      if (index < tickers.length - 1 && !stopRequested) {
        await controlledDelay(settings.delaySeconds, `Waiting before ${tickers[index + 1]}`);
      }
    }

    if (stopRequested) {
      logLine("Run stopped by user.");
      setRunState("Stopped", "is-stopped");
    } else {
      logLine("Run complete.");
      setRunState("Complete", "is-running");
    }
  } catch (error) {
    logLine(`Run stopped: ${error.message}`);
    setRunState("Error", "is-stopped");
  } finally {
    running = false;
    paused = false;
    stopRequested = false;
    updateControls();
  }
}

async function captureTicker(ticker, settings) {
  targetTabId = await ensureTargetTab();

  const pageUrl = `https://www.tipranks.com/stocks/${encodeURIComponent(
    ticker.toLowerCase(),
  )}/forecast`;

  logLine(`Opening ${pageUrl}`);
  const loadPromise = waitForTabComplete(targetTabId, 90000);
  await chrome.tabs.update(targetTabId, { url: pageUrl });
  await loadPromise;
  await sleep(1000);

  const capture = await captureTabHtml(targetTabId, settings);

  if (!capture.ok) {
    throw new Error(capture.reason || `Could not capture ${ticker}`);
  }

  const filename = buildFilename(settings.outputFolder, ticker);
  await downloadHtml(capture.html, filename);

  logLine(`Saved ${filename} (${formatCaptureDetails(capture)}).`);

  if (capture.tableCount === 0) {
    logLine(`Warning: ${ticker} saved, but no HTML <table> elements were detected.`);
  }
}

async function captureActiveTabOnce() {
  if (running) {
    logLine("A batch run is active. Stop it before using one-time capture.");
    return;
  }

  const tipranksTabs = await chrome.tabs.query({ url: "https://www.tipranks.com/*" });
  const activeTab = tipranksTabs.sort(
    (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0),
  )[0];

  if (!activeTab?.id) {
    logLine("Open a TipRanks tab first, then click the one-time capture button again.");
    return;
  }

  const settings = readSettings();
  await saveSettings();

  const tickerMatch = activeTab.url.match(/\/stocks\/([^/?#]+)\/forecast/i);
  const ticker = tickerMatch ? tickerMatch[1].toUpperCase() : "TIPRANKS-PAGE";

  try {
    setRunState("Saving", "is-running");
    const capture = await captureTabHtml(activeTab.id, settings);

    if (!capture.ok) {
      throw new Error(capture.reason || "Could not capture active TipRanks tab.");
    }

    const filename = buildFilename(settings.outputFolder, ticker);
    await downloadHtml(capture.html, filename);
    logLine(`Saved active tab as ${filename} (${formatCaptureDetails(capture)}).`);
    setRunState("Saved", "is-running");
  } catch (error) {
    logLine(`One-time capture failed: ${error.message}`);
    setRunState("Error", "is-stopped");
  }
}

async function ensureTargetTab() {
  if (targetTabId !== null) {
    try {
      const tab = await chrome.tabs.get(targetTabId);
      if (tab?.id) {
        return tab.id;
      }
    } catch (_error) {
      targetTabId = null;
    }
  }

  const tab = await chrome.tabs.create({ url: "about:blank", active: false });
  return tab.id;
}

async function captureTabHtml(tabId, settings) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: captureRenderedOuterHtml,
    args: [
      {
        loadWaitSeconds: settings.loadWaitSeconds,
        expandShowMore: settings.expandShowMore,
        showMoreMaxClicks: settings.showMoreMaxClicks,
        showMoreWaitSeconds: settings.showMoreWaitSeconds,
      },
    ],
  });

  return result.result;
}

async function downloadHtml(html, filename) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);

  try {
    await chrome.downloads.download({
      url: objectUrl,
      filename,
      conflictAction: "uniquify",
      saveAs: false,
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }
}

function captureRenderedOuterHtml(options) {
  const sleepInPage = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const loadWaitMs = Number(options.loadWaitSeconds || 15) * 1000;
  const expandShowMore = Boolean(options.expandShowMore);
  const showMoreMaxClicks = Math.max(0, Math.min(50, Number(options.showMoreMaxClicks || 0)));
  const showMoreWaitMs = Math.max(
    1000,
    Math.min(30000, Number(options.showMoreWaitSeconds || 3) * 1000),
  );
  const startedAt = Date.now();
  const readyTextPattern =
    /stock forecast|analyst ratings|price target|detailed list|forecast/i;
  const blockPattern =
    /captcha|are you a robot|access denied|too many requests|unusual traffic|verify you are human/i;
  const showMorePattern = /\b(show|load|view|see)\s+(more|all)\b/i;

  function isVisibleElement(element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity) > 0 &&
      element.getAttribute("aria-hidden") !== "true"
    );
  }

  function isDisabledElement(element) {
    return (
      element.disabled === true ||
      element.getAttribute("disabled") !== null ||
      element.getAttribute("aria-disabled") === "true"
    );
  }

  function getElementText(element) {
    return (element.innerText || element.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getTableRowCount() {
    return document.querySelectorAll("table tr").length;
  }

  function findShowMoreControl() {
    const candidates = Array.from(
      document.querySelectorAll(
        "button, a, [role='button'], [tabindex]:not([tabindex='-1'])",
      ),
    );

    return candidates.reverse().find((element) => {
      const text = getElementText(element);

      return (
        text &&
        showMorePattern.test(text) &&
        isVisibleElement(element) &&
        !isDisabledElement(element)
      );
    });
  }

  function dispatchMouseClick(element) {
    const rect = element.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const common = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX,
      clientY,
      button: 0,
    };

    if (window.PointerEvent) {
      element.dispatchEvent(new PointerEvent("pointerdown", common));
      element.dispatchEvent(new PointerEvent("pointerup", common));
    }

    element.dispatchEvent(new MouseEvent("mousedown", common));
    element.dispatchEvent(new MouseEvent("mouseup", common));
    element.dispatchEvent(new MouseEvent("click", common));
  }

  async function clickShowMoreControls() {
    const expansion = {
      clicks: 0,
      limitReached: false,
      lastText: "",
      rowCountBefore: getTableRowCount(),
      rowCountAfter: getTableRowCount(),
    };

    if (!expandShowMore || showMoreMaxClicks <= 0) {
      return expansion;
    }

    for (let clickIndex = 0; clickIndex < showMoreMaxClicks; clickIndex += 1) {
      if (blockPattern.test(document.body?.innerText || "")) {
        expansion.blockedReason =
          "TipRanks showed a challenge, rate-limit, or access-denied page while expanding Show More.";
        return expansion;
      }

      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "auto",
      });
      await sleepInPage(500);

      const control = findShowMoreControl();

      if (!control) {
        expansion.rowCountAfter = getTableRowCount();
        return expansion;
      }

      expansion.lastText = getElementText(control);
      control.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
      await sleepInPage(350);

      dispatchMouseClick(control);
      expansion.clicks += 1;
      await sleepInPage(showMoreWaitMs);
      expansion.rowCountAfter = getTableRowCount();
    }

    expansion.limitReached = Boolean(findShowMoreControl());
    expansion.rowCountAfter = getTableRowCount();
    return expansion;
  }

  return (async () => {
    while (Date.now() - startedAt < loadWaitMs) {
      const bodyText = document.body?.innerText || "";

      if (blockPattern.test(bodyText)) {
        return {
          ok: false,
          reason: "TipRanks showed a challenge, rate-limit, or access-denied page.",
        };
      }

      if (document.querySelector("table") || readyTextPattern.test(bodyText)) {
        break;
      }

      await sleepInPage(500);
    }

    await sleepInPage(1000);

    const showMoreExpansion = await clickShowMoreControls();

    if (showMoreExpansion.blockedReason) {
      return {
        ok: false,
        reason: showMoreExpansion.blockedReason,
      };
    }

    const html = `<!doctype html>\n${document.documentElement.outerHTML}`;
    const bodyText = document.body?.innerText || "";

    return {
      ok: true,
      url: window.location.href,
      title: document.title,
      html,
      bodyLength: bodyText.length,
      tableCount: document.querySelectorAll("table").length,
      tableRowCount: getTableRowCount(),
      showMoreEnabled: expandShowMore,
      showMoreClicks: showMoreExpansion.clicks,
      showMoreLimitReached: showMoreExpansion.limitReached,
      showMoreLastText: showMoreExpansion.lastText,
      showMoreRowCountBefore: showMoreExpansion.rowCountBefore,
      showMoreRowCountAfter: showMoreExpansion.rowCountAfter,
    };
  })();
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for the TipRanks page to load."));
    }, timeoutMs);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function controlledDelay(seconds, label) {
  const totalMs = seconds * 1000;
  const startedAt = Date.now();

  while (!stopRequested && Date.now() - startedAt < totalMs) {
    await waitIfPaused();
    const remainingSeconds = Math.ceil((totalMs - (Date.now() - startedAt)) / 1000);
    setProgress(`${label} (${remainingSeconds}s)`);
    await sleep(1000);
  }
}

async function waitIfPaused() {
  while (paused && !stopRequested) {
    setRunState("Paused", "");
    await sleep(500);
  }

  if (!stopRequested && running) {
    setRunState("Running", "is-running");
  }
}

function togglePause() {
  paused = !paused;
  updateControls();
  logLine(paused ? "Paused." : "Resumed.");
}

function requestStop() {
  stopRequested = true;
  paused = false;
  updateControls();
  logLine("Stop requested. The current page capture will finish first.");
}

function updateControls() {
  els.startButton.disabled = running;
  els.pauseButton.disabled = !running;
  els.stopButton.disabled = !running;
  els.captureActiveButton.disabled = running;
  els.pauseButton.textContent = paused ? "Resume" : "Pause";

  if (running) {
    setRunState(paused ? "Paused" : "Running", "is-running");
  }
}

function setProgress(label, current, total) {
  if (label) {
    els.progressLabel.textContent = label;
  }

  if (Number.isFinite(current) && Number.isFinite(total)) {
    els.progressCount.textContent = `${current} / ${total}`;
    els.progressBar.max = Math.max(total, 1);
    els.progressBar.value = current;
  }
}

function setRunState(label, className) {
  els.runState.textContent = label;
  els.runState.className = ["status-pill", className].filter(Boolean).join(" ");
}

function logLine(message) {
  const time = new Date().toLocaleTimeString();
  els.log.textContent += `[${time}] ${message}\n`;
  els.log.scrollTop = els.log.scrollHeight;
}

function formatCaptureDetails(capture) {
  const tableNote = capture.tableCount === 1 ? "1 table" : `${capture.tableCount} tables`;
  const rowNote = `${Number(capture.tableRowCount || 0).toLocaleString()} rows`;
  const sizeNote = `${capture.html.length.toLocaleString()} chars`;
  const details = [tableNote, rowNote, sizeNote];

  if (capture.showMoreEnabled) {
    details.push(`Show More clicks: ${capture.showMoreClicks || 0}`);

    if (capture.showMoreLimitReached) {
      details.push("max click limit reached");
    }
  }

  return details.join(", ");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}

function sanitizeFolder(folder) {
  return folder
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.\./g, "")
    .replace(/[^A-Za-z0-9/_ .-]/g, "-")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

function buildFilename(folder, ticker) {
  const safeTicker = ticker.replace(/[^A-Z0-9.-]/gi, "-").toUpperCase();
  return `${folder || "tipranks-html"}/${safeTicker}-forecast.html`;
}
