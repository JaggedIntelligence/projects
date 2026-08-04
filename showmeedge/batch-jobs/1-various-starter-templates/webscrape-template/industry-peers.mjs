export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
export const DEFAULT_TICKER = "AAPL";

export function buildYahooQuoteUrl(ticker) {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(normalizeTicker(ticker))}/`;
}

export function normalizeTicker(ticker) {
  const normalized = String(ticker ?? "").trim().toUpperCase();
  if (!normalized) {
    throw new Error("ticker is required");
  }

  return normalized;
}

export async function scrapeIndustryPeerRecords({ page, ticker, timeoutMs = DEFAULT_TIMEOUT_MS, includeSource = false }) {
  const sourceTicker = normalizeTicker(ticker);
  const url = buildYahooQuoteUrl(sourceTicker);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForFunction(hasComparePeerGroupCarousel, null, { timeout: timeoutMs });

  const peerGroupRecords = await page.evaluate(extractComparePeerGroupCarousel);

  return peerGroupRecords
    .filter((record) => includeSource || record.peerTicker !== sourceTicker)
    .map((record) => ({
      sourceTicker,
      ...record,
      sourceUrl: url
    }));
}

function hasComparePeerGroupCarousel() {
  return Array.from(document.querySelectorAll('[data-testid="compare-to"]')).some((section) => {
    const carousel = section.querySelector('[data-testid="carousel-container"]');
    return Boolean(carousel?.querySelector('[data-testid="card-container"] a[href*="/quote/"]'));
  });
}

function extractComparePeerGroupCarousel() {
  const section = Array.from(document.querySelectorAll('[data-testid="compare-to"]')).find((candidate) =>
    candidate.querySelector('[data-testid="carousel-container"]')
  );

  if (!section) {
    throw new Error('Could not find Yahoo compare peer carousel: [data-testid="compare-to"]');
  }

  const cards = Array.from(section.querySelectorAll('[data-testid="carousel-container"] [data-testid="card-container"]'));
  const records = cards
    .map((card, index) => {
      const quoteLink = Array.from(card.querySelectorAll('a[href*="/quote/"]')).find((link) =>
        getTickerFromQuoteHref(link.getAttribute("href"))
      );

      if (!quoteLink) {
        return null;
      }

      const peerTicker = getTickerFromQuoteHref(quoteLink.getAttribute("href"));
      const companyName = compactText(card.querySelector(".longName")?.textContent);
      const metrics = getCardMetrics(card);

      return {
        rank: index + 1,
        peerTicker,
        companyName: companyName || null,
        price: compactText(card.querySelector(".price")?.textContent) || null,
        changePercent: compactText(card.querySelector(".changes span")?.textContent) || null,
        marketCap: metrics.marketCap ?? null,
        industry: metrics.industry ?? null,
        quoteUrl: new URL(quoteLink.getAttribute("href"), window.location.origin).toString()
      };
    })
    .filter(Boolean);

  return dedupeByTicker(records);

  function getCardMetrics(card) {
    const metrics = {};

    for (const row of Array.from(card.querySelectorAll(".moreInfo"))) {
      const label = compactText(row.querySelector(".title")?.textContent).toLowerCase();
      const value = compactText(row.querySelector(".value")?.textContent);

      if (!label || !value) {
        continue;
      }

      if (label === "industry") {
        metrics.industry = value;
      } else if (label.replace(/\s+/g, "") === "mktcap") {
        metrics.marketCap = value;
      }
    }

    return metrics;
  }

  function getTickerFromQuoteHref(href) {
    if (!href) {
      return null;
    }

    try {
      const pathname = new URL(href, window.location.origin).pathname;
      const match = pathname.match(/^\/quote\/([^/]+)/);
      return match ? decodeURIComponent(match[1]).toUpperCase() : null;
    } catch {
      return null;
    }
  }

  function dedupeByTicker(items) {
    const seen = new Set();
    return items.filter((item) => {
      if (seen.has(item.peerTicker)) {
        return false;
      }

      seen.add(item.peerTicker);
      return true;
    });
  }

  function compactText(value) {
    return String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
