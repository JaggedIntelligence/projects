"use client";

import { NightVisionMarketChartPanel } from "@/components/trading/nightvision-market-chart-panel";
import { NvOuterlayerPage } from "@/components/trading/nv-outerlayer-page";

export function NightVisionTradingPage() {
  return <NvOuterlayerPage ChartPanel={NightVisionMarketChartPanel} />;
}
