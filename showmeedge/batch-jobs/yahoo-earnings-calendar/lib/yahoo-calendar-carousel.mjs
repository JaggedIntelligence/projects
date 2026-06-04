export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
export const DEFAULT_PAGE_SIZE = 100;

export function buildYahooEarningsUrl({ from, to, day, offset, size }) {
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

export async function scrapeWeeklyManifestRecords({ page, from, to, timeoutMs, pageSize = DEFAULT_PAGE_SIZE }) {
  const url = buildYahooEarningsUrl({ from, to });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForFunction(hasEarningsDateCarousel, null, { timeout: timeoutMs });

  const earningsDates = await page.evaluate(extractEarningsDateCarousel);

  return earningsDates.map((item) => ({
    date: item.date,
    label: item.label,
    from,
    to,
    expectedCount: item.earningsCount,
    urls: buildPaginationUrls({ from, to, day: item.date, count: item.earningsCount, pageSize })
  }));
}

export function buildPaginationUrls({ from, to, day, count, pageSize = DEFAULT_PAGE_SIZE }) {
  const urls = [];

  for (let offset = 0; offset < count; offset += pageSize) {
    urls.push(buildYahooEarningsUrl({ from, to, day, offset, size: pageSize }));
  }

  return urls;
}

function hasEarningsDateCarousel() {
  return Array.from(document.querySelectorAll('[data-testid="carousel-container"]')).some((carousel) =>
    carousel.querySelector('[data-testid="calendar-event-pill"]')
  );
}

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

      return {
        date: getDayFromHref(href),
        label,
        text,
        earningsCount: parseEarningsCount(text)
      };
    })
    .filter((item) => item?.date && Number.isFinite(item.earningsCount));

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
}

