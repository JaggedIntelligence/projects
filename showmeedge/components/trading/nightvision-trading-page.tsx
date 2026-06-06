"use client";

import { NightVisionMarketChartPanel } from "@/components/trading/nightvision-market-chart-panel";
import { NightVisionOuterlayerPage } from "@/components/trading/nightvision-outerlayer-page";

export function NightVisionTradingPage() {
  return <NightVisionOuterlayerPage ChartPanel={NightVisionMarketChartPanel} />;
}
