"use client";

import { NightVisionMarketChartPanel } from "@/components/trading/nightvision-market-chart-panel";
import { TradingPage } from "@/components/trading/trading-page";

export function NightVisionTradingPage() {
  return <TradingPage ChartPanel={NightVisionMarketChartPanel} />;
}
