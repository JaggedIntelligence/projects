import type { Metadata } from "next";

import { NvChartMainPage } from "@/components/nvcharts/nightvision-chart-main-page";

export const metadata: Metadata = {
  title: "Night Vision Charts Setup",
  description: "Chart setup with live DB-backed market data rendered in Night Vision."
};

export default function NightVisionPage() {
  return <NvChartMainPage />;
}
