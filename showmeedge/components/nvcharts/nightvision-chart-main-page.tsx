"use client";

import { NightVisionMarketChartPanel } from "@/components/nvcharts/nightvision-market-chart-panel";
import { NightVisionOuterlayerPage } from "@/components/nvcharts/nightvision-outerlayer-page";

export function NvChartMainPage() {
  return <NightVisionOuterlayerPage ChartPanel={NightVisionMarketChartPanel} />;
}
