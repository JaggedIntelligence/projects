export const CHART_AREA_COLOR_KEYS = ["sky", "amber", "emerald", "rose", "violet", "orange"] as const;

export type ChartAreaColorKey = (typeof CHART_AREA_COLOR_KEYS)[number];

export const DEFAULT_CHART_AREA_COLOR_KEY: ChartAreaColorKey = "sky";

export const CHART_AREA_COLORS: Record<
  ChartAreaColorKey,
  {
    label: string;
    solid: string;
    border: string;
    fill: string;
  }
> = {
  sky: { label: "Sky", solid: "#38bdf8", border: "#38bdf8cc", fill: "#38bdf833" },
  amber: { label: "Amber", solid: "#f8c537", border: "#f8c537cc", fill: "#f8c53733" },
  emerald: { label: "Emerald", solid: "#22c55e", border: "#22c55ecc", fill: "#22c55e33" },
  rose: { label: "Rose", solid: "#fb7185", border: "#fb7185cc", fill: "#fb718533" },
  violet: { label: "Violet", solid: "#a78bfa", border: "#a78bfacc", fill: "#a78bfa33" },
  orange: { label: "Orange", solid: "#fb923c", border: "#fb923ccc", fill: "#fb923c33" }
};
