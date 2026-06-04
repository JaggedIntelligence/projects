export async function scrapeEarningsRowsFromUrl({ page, url, date, timeoutMs }) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForFunction(hasEarningsTable, null, { timeout: timeoutMs });

  const result = await page.evaluate(extractEarningsTable);
  return {
    ...result,
    rows: result.rows.map((row) => ({
      date,
      ...row,
      sourceUrl: url
    }))
  };
}

function hasEarningsTable() {
  return Array.from(document.querySelectorAll("table")).some((table) => {
    const headerText = table.innerText || "";
    return headerText.includes("Symbol") && headerText.includes("EPS Estimate") && headerText.includes("Reported EPS");
  });
}

function extractEarningsTable() {
  const table = Array.from(document.querySelectorAll("table")).find((candidate) => {
    const text = candidate.innerText || "";
    return text.includes("Symbol") && text.includes("EPS Estimate") && text.includes("Reported EPS");
  });

  if (!table) {
    throw new Error("Could not find Yahoo earnings table in rendered page");
  }

  const bodyText = document.body.innerText || "";
  const selectedDayLabel = bodyText.match(/Earnings On [^\n]+/)?.[0] ?? null;
  const rangeLabel = bodyText.match(/[A-Z][a-z]{2} \d{1,2}, \d{4} - [A-Z][a-z]{2} \d{1,2}, \d{4}/)?.[0] ?? null;

  const rows = Array.from(table.querySelectorAll("tbody tr"))
    .map((row) => {
      const cells = Array.from(row.querySelectorAll("th, td")).map((cell) => compactText(cell.innerText));
      return {
        symbol: cells[0] || null,
        companyName: cells[1] || null,
        eventName: emptyToNull(cells[2]),
        earningsCallTime: emptyToNull(cells[3]),
        epsEstimate: parseNullableNumber(cells[4]),
        reportedEps: parseNullableNumber(cells[5]),
        surprisePercent: parseNullableNumber(cells[6]),
        marketCap: emptyToNull(cells[7])
      };
    })
    .filter((row) => row.symbol);

  return {
    title: document.title,
    rangeLabel,
    selectedDayLabel,
    rowCount: rows.length,
    rows
  };

  function compactText(value) {
    return String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function emptyToNull(value) {
    if (!value || value === "-") {
      return null;
    }
    return value;
  }

  function parseNullableNumber(value) {
    if (!value || value === "-") {
      return null;
    }

    const normalized = value.replace(/[$,%]/g, "").replace(/,/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
}

