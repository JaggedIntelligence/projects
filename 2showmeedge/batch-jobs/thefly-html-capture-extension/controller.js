const DEFAULT_SETTINGS = {
  targetUrl: "https://www.thefly.com/research",
  loadWaitSeconds: 15,
  outputFolder: "thefly-html",
  outputFilename: "thefly-research.html",
  scheduleEnabled: true,
  scheduleTimes: "18:00\n04:00\n05:00\n06:00",
};

const els = {
  targetUrl: document.querySelector("#targetUrl"),
  loadWaitSeconds: document.querySelector("#loadWaitSeconds"),
  outputFolder: document.querySelector("#outputFolder"),
  outputFilename: document.querySelector("#outputFilename"),
  scheduleEnabled: document.querySelector("#scheduleEnabled"),
  scheduleTimes: document.querySelector("#scheduleTimes"),
  nextScheduledRun: document.querySelector("#nextScheduledRun"),
  saveScheduleButton: document.querySelector("#saveScheduleButton"),
  openAndSaveButton: document.querySelector("#openAndSaveButton"),
  saveActiveButton: document.querySelector("#saveActiveButton"),
  stopButton: document.querySelector("#stopButton"),
  clearLogButton: document.querySelector("#clearLogButton"),
  runState: document.querySelector("#runState"),
  progressLabel: document.querySelector("#progressLabel"),
  pageStats: document.querySelector("#pageStats"),
  progressBar: document.querySelector("#progressBar"),
  log: document.querySelector("#log"),
};

let targetTabId = null;
let running = false;
let stopRequested = false;

init();

async function init() {
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  els.targetUrl.value = settings.targetUrl;
  els.loadWaitSeconds.value = settings.loadWaitSeconds;
  els.outputFolder.value = settings.outputFolder;
  els.outputFilename.value = settings.outputFilename;
  els.scheduleEnabled.checked = Boolean(settings.scheduleEnabled);
  els.scheduleTimes.value = settings.scheduleTimes || DEFAULT_SETTINGS.scheduleTimes;

  for (const input of [
    els.targetUrl,
    els.loadWaitSeconds,
    els.outputFolder,
    els.outputFilename,
    els.scheduleEnabled,
    els.scheduleTimes,
  ]) {
    input.addEventListener("input", saveSettings);
    input.addEventListener("change", saveSettings);
  }

  els.openAndSaveButton.addEventListener("click", openAndSave);
  els.saveActiveButton.addEventListener("click", saveMostRecentTheFlyTab);
  els.stopButton.addEventListener("click", requestStop);
  els.saveScheduleButton.addEventListener("click", async () => {
    await saveSettings();
    logLine("Schedule saved.");
  });
  els.clearLogButton.addEventListener("click", () => {
    els.log.textContent = "";
  });

  setRunState("Idle", "");
  updateControls();
  await refreshScheduleStatus();
  logLine("Ready. Log into TheFly in Chrome first, then save the research page.");

  if (new URLSearchParams(window.location.search).get("autorun") === "1") {
    logLine("Scheduled run started.");
    await openAndSave({ scheduled: true });
  }
}

async function saveSettings() {
  await chrome.storage.local.set(readSettings());
  await refreshScheduleStatus();
}

function readSettings() {
  return {
    targetUrl: normalizeTheFlyUrl(els.targetUrl.value || DEFAULT_SETTINGS.targetUrl),
    loadWaitSeconds: clampNumber(
      els.loadWaitSeconds.value,
      1,
      180,
      DEFAULT_SETTINGS.loadWaitSeconds,
    ),
    outputFolder: sanitizeFolder(els.outputFolder.value || DEFAULT_SETTINGS.outputFolder),
    outputFilename: sanitizeFilename(
      els.outputFilename.value || DEFAULT_SETTINGS.outputFilename,
    ),
    scheduleEnabled: els.scheduleEnabled.checked,
    scheduleTimes: els.scheduleTimes.value || DEFAULT_SETTINGS.scheduleTimes,
  };
}

async function openAndSave(options = {}) {
  if (running) {
    return;
  }

  const settings = readSettings();
  await saveSettings();

  running = true;
  stopRequested = false;
  updateControls();
  setRunState("Opening", "is-running");
  setProgress("Opening TheFly page", 0);

  try {
    targetTabId = await ensureTargetTab();
    logLine(`Opening ${settings.targetUrl}`);

    const loadPromise = waitForTabComplete(targetTabId, 120000);
    await chrome.tabs.update(targetTabId, { url: settings.targetUrl });
    await loadPromise;

    if (stopRequested) {
      logLine("Stopped before capture.");
      setRunState("Stopped", "is-stopped");
      return;
    }

    await captureAndDownload(targetTabId, settings);
    setRunState("Saved", "is-running");
    setProgress("Saved HTML", 1);

    if (options.scheduled) {
      logLine("Scheduled save complete. Closing scheduled tabs shortly.");
      window.setTimeout(closeScheduledTabs, 5000);
    }
  } catch (error) {
    logLine(`Save failed: ${error.message}`);
    setRunState("Error", "is-stopped");
  } finally {
    running = false;
    stopRequested = false;
    updateControls();
  }
}

async function saveMostRecentTheFlyTab() {
  if (running) {
    return;
  }

  const settings = readSettings();
  await saveSettings();

  const theFlyTabs = await chrome.tabs.query({
    url: ["https://www.thefly.com/*", "https://thefly.com/*"],
  });
  const tab = theFlyTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];

  if (!tab?.id) {
    logLine("Open a TheFly tab first, then click Save Most Recent TheFly Tab again.");
    return;
  }

  running = true;
  stopRequested = false;
  updateControls();
  setRunState("Saving", "is-running");
  setProgress("Saving existing TheFly tab", 0);

  try {
    await captureAndDownload(tab.id, settings);
    setRunState("Saved", "is-running");
    setProgress("Saved HTML", 1);
  } catch (error) {
    logLine(`Save failed: ${error.message}`);
    setRunState("Error", "is-stopped");
  } finally {
    running = false;
    stopRequested = false;
    updateControls();
  }
}

async function captureAndDownload(tabId, settings) {
  setProgress(`Waiting ${settings.loadWaitSeconds}s for rendered content`, 0.5);
  const capture = await captureTabHtml(tabId, settings);

  if (!capture.ok) {
    throw new Error(capture.reason || "Could not capture TheFly HTML.");
  }

  if (stopRequested) {
    return;
  }

  const filename = buildFilename(settings.outputFolder, settings.outputFilename, new Date());
  await downloadHtml(capture.html, filename);
  els.pageStats.textContent = `${capture.html.length.toLocaleString()} chars`;
  logLine(
    `Saved ${filename} (${capture.html.length.toLocaleString()} chars, ${capture.bodyLength.toLocaleString()} body chars).`,
  );

  if (capture.possibleLoginPage) {
    logLine("Warning: saved page may be a login/subscription page. Confirm the downloaded HTML.");
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
    args: [{ loadWaitSeconds: settings.loadWaitSeconds }],
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
  const loadWaitMs = Math.max(1000, Number(options.loadWaitSeconds || 15) * 1000);
  const startedAt = Date.now();
  const loginPattern = /\b(log\s*in|sign\s*in|subscribe|subscription|required)\b/i;

  return (async () => {
    while (document.readyState !== "complete" && Date.now() - startedAt < 30000) {
      await sleepInPage(500);
    }

    await sleepInPage(loadWaitMs);

    const html = `<!doctype html>\n${document.documentElement.outerHTML}`;
    const bodyText = document.body?.innerText || "";

    return {
      ok: true,
      url: window.location.href,
      title: document.title,
      html,
      bodyLength: bodyText.length,
      possibleLoginPage: loginPattern.test(bodyText),
    };
  })();
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for TheFly page to load."));
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

function requestStop() {
  stopRequested = true;
  updateControls();
  logLine("Stop requested. The current wait or capture will finish first.");
}

function updateControls() {
  els.openAndSaveButton.disabled = running;
  els.saveActiveButton.disabled = running;
  els.stopButton.disabled = !running;
}

async function refreshScheduleStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "schedule:refresh" });

    if (!response?.ok || !response.nextRun) {
      els.nextScheduledRun.textContent = els.scheduleEnabled.checked
        ? "No valid run time"
        : "Schedule disabled";
      return;
    }

    els.nextScheduledRun.textContent = response.nextRun.label;
  } catch (error) {
    els.nextScheduledRun.textContent = "Schedule unavailable";
  }
}

function setProgress(label, value) {
  els.progressLabel.textContent = label;
  els.progressBar.value = value;
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

function clampNumber(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeTheFlyUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch (_error) {
    return DEFAULT_SETTINGS.targetUrl;
  }

  if (!/(^|\.)thefly\.com$/i.test(url.hostname)) {
    return DEFAULT_SETTINGS.targetUrl;
  }

  url.protocol = "https:";
  return url.toString();
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

function sanitizeFilename(filename) {
  const safeName = filename
    .trim()
    .replace(/[\\/]/g, "-")
    .replace(/\.\./g, "")
    .replace(/[^A-Za-z0-9_. -]/g, "-");

  if (!safeName) {
    return DEFAULT_SETTINGS.outputFilename;
  }

  return /\.html?$/i.test(safeName) ? safeName : `${safeName}.html`;
}

async function closeScheduledTabs() {
  try {
    if (targetTabId !== null) {
      await chrome.tabs.remove(targetTabId);
    }
  } catch (_error) {
    // The user may have already closed the tab.
  }

  try {
    const currentTab = await chrome.tabs.getCurrent();

    if (currentTab?.id) {
      await chrome.tabs.remove(currentTab.id);
    }
  } catch (_error) {
    // Leave the controller open if Chrome does not allow this tab to close.
  }
}

function buildFilename(folder, filename, date) {
  return `${folder || DEFAULT_SETTINGS.outputFolder}/${addTimestampToFilename(filename, date)}`;
}

function addTimestampToFilename(filename, date) {
  const timestamp = formatFilenameTimestamp(date);
  const match = filename.match(/^(.*?)(\.[^.]+)?$/);
  const base = match?.[1] || DEFAULT_SETTINGS.outputFilename.replace(/\.html?$/i, "");
  const extension = match?.[2] || ".html";

  return `${base}-${timestamp}${extension}`;
}

function formatFilenameTimestamp(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}-${pad2(
    date.getHours(),
  )}${pad2(date.getMinutes())}`;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}
