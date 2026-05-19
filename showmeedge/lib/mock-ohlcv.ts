import type { Timeframe } from "@/lib/market-data-validators";

export type OhlcvBar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const seedPrices: Record<string, number> = {
  AAPL: 186,
  MSFT: 425,
  NVDA: 890,
  SPY: 510,
  TSLA: 178
};

const tickerOffsets: Record<string, number> = {
  AAPL: 0,
  MSFT: 5,
  NVDA: 11,
  SPY: 17,
  TSLA: 23
};

function tickerSeed(ticker: string) {
  return ticker.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function tradingDates() {
  const dates: string[] = [];
  const cursor = new Date(Date.UTC(2025, 0, 2));

  while (dates.length < 90) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export function getMockOhlcvBars(ticker: string, timeframe: Timeframe = "1d"): OhlcvBar[] {
  if (timeframe !== "1d") return [];

  const normalizedTicker = ticker.toUpperCase();
  const base = seedPrices[normalizedTicker] ?? 90 + (tickerSeed(normalizedTicker) % 180);
  const offset = tickerOffsets[normalizedTicker] ?? tickerSeed(normalizedTicker) % 31;

  return tradingDates().map((time, index) => {
    const wave = Math.sin((index + offset) / 5) * 4.8;
    const drift = index * 0.18;
    const noise = Math.cos((index + offset) / 3) * 1.7;
    const open = base + drift + wave + noise;
    const close = open + Math.sin((index + offset) / 2.7) * 2.2;
    const high = Math.max(open, close) + 1.4 + Math.abs(Math.cos(index / 4)) * 1.8;
    const low = Math.min(open, close) - 1.3 - Math.abs(Math.sin(index / 6)) * 1.6;
    const volumeBase = 900_000 + (tickerSeed(normalizedTicker) % 9) * 120_000;
    const volume = Math.round(volumeBase + Math.abs(Math.sin((index + offset) / 4)) * volumeBase * 0.75);

    return {
      time,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume
    };
  });
}

