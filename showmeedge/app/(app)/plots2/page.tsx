"use client";

import { useEffect, useMemo, useState } from "react";
import UplotReact from "uplot-react";
import "uplot/dist/uPlot.min.css";

const DATA_URL = "https://leeoniya.github.io/uPlot/bench/data.json";

type PackedData = Array<number | string>;
type ChartData = [number[], number[], number[], number[]];

function round2(val: number) {
  return Math.round(val * 100) / 100;
}

function round3(val: number) {
  return Math.round(val * 1000) / 1000;
}

function isPackedData(value: unknown): value is PackedData {
  return Array.isArray(value) && typeof value[0] === "number";
}

function prepData(packed: PackedData): ChartData {
  console.time("prep");

  const numFields = packed[0];

  if (typeof numFields !== "number") {
    throw new Error("Packed data is missing its field count.");
  }

  const values = packed.slice(numFields + 1);

  if (!values.every((value) => typeof value === "number")) {
    throw new Error("Packed data rows must contain numbers only.");
  }

  const rowCount = Math.floor(values.length / numFields);
  const data: ChartData = [
    Array(rowCount),
    Array(rowCount),
    Array(rowCount),
    Array(rowCount)
  ];

  for (let i = 0, j = 0; j < rowCount; i += numFields, j += 1) {
    const epoch = values[i];
    const idle = values[i + 1];
    const send = values[i + 3];
    const used = values[i + 5];
    const free = values[i + 6];

    data[0][j] = epoch * 60;
    data[1][j] = round3(100 - idle);
    data[2][j] = round2((100 * used) / (used + free));
    data[3][j] = send;
  }

  console.timeEnd("prep");

  return data;
}

function getStrokeWidth() {
  return typeof window === "undefined" ? 1 : 1 / window.devicePixelRatio;
}

export default function TimeSeriesChart() {
  const [data, setData] = useState<ChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const options = useMemo(() => {
    const strokeWidth = getStrokeWidth();

    return {
      title: "Server Events",
      width: 1200,
      height: 600,
      series: [
        {},
        {
          label: "CPU",
          scale: "%",
          value: (_u: unknown, v: number | null) =>
            v == null ? "" : `${v.toFixed(1)}%`,
          stroke: "red",
          width: strokeWidth
        },
        {
          label: "RAM",
          scale: "%",
          value: (_u: unknown, v: number | null) =>
            v == null ? "" : `${v.toFixed(1)}%`,
          stroke: "blue",
          width: strokeWidth
        },
        {
          label: "TCP Out",
          scale: "mb",
          value: (_u: unknown, v: number | null) =>
            v == null ? "" : `${v.toFixed(2)} MB`,
          stroke: "green",
          width: strokeWidth
        }
      ],
      axes: [
        {},
        {
          scale: "%",
          values: (_u: unknown, vals: number[]) =>
            vals.map((v) => `${Number(v.toFixed(1))}%`)
        },
        {
          side: 1,
          scale: "mb",
          size: 60,
          values: (_u: unknown, vals: number[]) =>
            vals.map((v) => `${Number(v.toFixed(2))} MB`),
          grid: { show: false }
        }
      ]
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(DATA_URL, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }

        const packed = (await response.json()) as unknown;

        if (!isPackedData(packed)) {
          throw new Error("The response was not the expected packed array.");
        }

        setData(prepData(packed));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to load chart data.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => controller.abort();
  }, []);

  return (
    <main className="space-y-4 p-6">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading chart data...</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : data ? (
        <div className="overflow-x-auto">
          <UplotReact options={options} data={data} />
        </div>
      ) : null}
    </main>
  );
}
