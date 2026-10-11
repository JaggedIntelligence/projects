import type { Metadata } from "next";

import { SeasonalityPage } from "@/components/seasonality/seasonality-page";

export const metadata: Metadata = {
  title: "Seasonality",
  description: "View stock seasonality from QuestDB cache tables."
};

export default function SeasonalityRoute() {
  return <SeasonalityPage />;
}
