import type { Metadata } from "next";

import { NightVisionTradingPage } from "@/components/trading/nightvision-trading-page";

export const metadata: Metadata = {
  title: "Night Vision Trading Setup",
  description: "Trading setup with live DB-backed market data rendered in Night Vision."
};

export default function NightVisionPage() {
  return <NightVisionTradingPage />;
}
