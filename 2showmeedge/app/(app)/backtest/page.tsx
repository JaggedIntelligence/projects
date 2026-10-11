import type { Metadata } from "next";

import { BacktestPage } from "@/components/backtest/backtest-page";

export const metadata: Metadata = {
  title: "Backtest",
  description: "Run a dual-SMA crossover backtest."
};

export default function BacktestRoute() {
  return <BacktestPage />;
}
