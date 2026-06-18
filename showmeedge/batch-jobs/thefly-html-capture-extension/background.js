const CONTROLLER_PAGE = "controller.html";
const SCHEDULE_ALARM_NAME = "thefly-scheduled-capture";
const DEFAULT_SCHEDULE = {
  scheduleEnabled: true,
  scheduleTimes: "18:00\n04:00\n05:00\n06:00",
};

chrome.action.onClicked.addListener(async () => {
  const controllerUrl = chrome.runtime.getURL(CONTROLLER_PAGE);
  const existingTabs = await chrome.tabs.query({ url: controllerUrl });

  if (existingTabs.length > 0 && existingTabs[0].id) {
    await chrome.tabs.update(existingTabs[0].id, { active: true });

    if (existingTabs[0].windowId) {
      await chrome.windows.update(existingTabs[0].windowId, { focused: true });
    }

    return;
  }

  await chrome.tabs.create({ url: controllerUrl });
});

chrome.runtime.onInstalled.addListener(() => {
  refreshScheduleAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  refreshScheduleAlarm();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "schedule:refresh") {
    return false;
  }

  refreshScheduleAlarm()
    .then((nextRun) => {
      sendResponse({ ok: true, nextRun });
    })
    .catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== SCHEDULE_ALARM_NAME) {
    return;
  }

  runScheduledCapture();
});

refreshScheduleAlarm();

async function runScheduledCapture() {
  const nextRun = await refreshScheduleAlarm();

  if (!nextRun) {
    return;
  }

  const url = chrome.runtime.getURL(`${CONTROLLER_PAGE}?autorun=1&scheduledAt=${Date.now()}`);
  await chrome.tabs.create({ url, active: false });
}

async function refreshScheduleAlarm() {
  const settings = await chrome.storage.local.get(DEFAULT_SCHEDULE);

  if (!settings.scheduleEnabled) {
    await chrome.alarms.clear(SCHEDULE_ALARM_NAME);
    await chrome.storage.local.remove(["scheduleNextRunAt", "scheduleNextRunLabel"]);
    return null;
  }

  const scheduleMinutes = parseScheduleTimes(settings.scheduleTimes);

  if (scheduleMinutes.length === 0) {
    await chrome.alarms.clear(SCHEDULE_ALARM_NAME);
    await chrome.storage.local.remove(["scheduleNextRunAt", "scheduleNextRunLabel"]);
    return null;
  }

  const nextRun = getNextRunDate(scheduleMinutes);
  await chrome.alarms.create(SCHEDULE_ALARM_NAME, {
    when: nextRun.getTime(),
    persistAcrossSessions: true,
  });

  const nextRunInfo = {
    iso: nextRun.toISOString(),
    label: formatLocalDateTime(nextRun),
  };

  await chrome.storage.local.set({
    scheduleNextRunAt: nextRunInfo.iso,
    scheduleNextRunLabel: nextRunInfo.label,
  });

  return nextRunInfo;
}

function parseScheduleTimes(value) {
  return Array.from(
    new Set(
      String(value || DEFAULT_SCHEDULE.scheduleTimes)
        .split(/[\s,;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map(parseTimeToMinutes)
        .filter((minutes) => minutes !== null),
    ),
  ).sort((a, b) => a - b);
}

function parseTimeToMinutes(value) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function getNextRunDate(scheduleMinutes) {
  const now = new Date();
  const minimumNextRun = new Date(now.getTime() + 30000);

  for (const dayOffset of [0, 1]) {
    for (const minutesOfDay of scheduleMinutes) {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() + dayOffset);
      candidate.setHours(Math.floor(minutesOfDay / 60), minutesOfDay % 60, 0, 0);

      if (candidate > minimumNextRun) {
        return candidate;
      }
    }
  }

  const first = scheduleMinutes[0];
  const candidate = new Date(now);
  candidate.setDate(now.getDate() + 1);
  candidate.setHours(Math.floor(first / 60), first % 60, 0, 0);
  return candidate;
}

function formatLocalDateTime(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(
    date.getHours(),
  )}:${pad2(date.getMinutes())}`;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}
