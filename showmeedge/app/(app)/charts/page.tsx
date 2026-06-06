import type { Metadata } from "next";

import { NightVisionTradingPage } from "@/components/trading/nightvision-trading-page";

export const metadata: Metadata = {
  title: "Night Vision Charts Setup",
  description: "Chart setup with live DB-backed market data rendered in Night Vision."
};

export default function NightVisionPage() {
  return <NightVisionTradingPage />;
}
