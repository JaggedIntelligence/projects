import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export const DEFAULT_UNIVERSE = "sp500_current";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const DATA_DIR = join(REPO_ROOT, "services", "market-api", "app", "data");

export function resolveUniverseCsvPath(universe = DEFAULT_UNIVERSE) {
  const normalizedUniverse = String(universe ?? "").trim();
  if (!normalizedUniverse) {
    throw new Error("universe is required");
  }

  return join(DATA_DIR, `${normalizedUniverse}.csv`);
}

export async function loadSymbolUniverse(universe = DEFAULT_UNIVERSE) {
  const csvPath = resolveUniverseCsvPath(universe);
  const content = await readFile(csvPath, "utf8");
  const rows = parseCsv(content);

  return rows.filter(hasSymbol).map((row) => toSymbolRecord(row, universe));
}

export function filterSymbolUniverse(records, { ticker = null, maxSymbols = null } = {}) {
  let filteredRecords = records;

  if (ticker) {
    const normalizedTicker = normalizeSymbol(ticker);
    filteredRecords = filteredRecords.filter(
      (record) => record.sourceTicker === normalizedTicker || record.providerSymbol === normalizedTicker
    );
  }

  if (maxSymbols != null) {
    filteredRecords = filteredRecords.slice(0, maxSymbols);
  }

  return filteredRecords;
}

export function normalizeSymbol(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) {
    throw new Error("symbol is required");
  }

  return normalized;
}

function toSymbolRecord(row, universe) {
  const sourceTicker = normalizeSymbol(value(row, "symbol", "Symbol"));
  const providerSymbol = normalizeSymbol(value(row, "provider_symbol", "Provider Symbol") || toYahooSymbol(sourceTicker));

  return {
    sourceTicker,
    providerSymbol,
    name: value(row, "name", "Security") || sourceTicker,
    exchange: value(row, "exchange", "Exchange") || null,
    currency: (value(row, "currency", "Currency") || "USD").toUpperCase(),
    sector: value(row, "sector", "GICS Sector") || null,
    industry: value(row, "industry", "GICS Sub-Industry") || null,
    universe
  };
}

function hasSymbol(row) {
  return Boolean(value(row, "symbol", "Symbol"));
}

function value(row, ...keys) {
  for (const key of keys) {
    const currentValue = row[key];
    if (currentValue != null && String(currentValue).trim()) {
      return String(currentValue).trim();
    }
  }

  return "";
}

function toYahooSymbol(symbol) {
  return symbol.replace(".", "-");
}

function parseCsv(content) {
  const rows = parseCsvRows(content).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
  );
}

function parseCsvRows(content) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (inQuotes) {
    throw new Error("CSV contains an unterminated quoted field");
  }

  return rows;
}
