"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Database, Play } from "lucide-react";
import Papa from "papaparse";
import { FormEvent, useMemo, useState } from "react";

import { api } from "@/components/providers/trpc-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_SQL = `SELECT ts, symbol, provider, open, high, low, close, volume
FROM equity_ohlcv_daily
WHERE symbol = 'AAPL'
ORDER BY ts DESC
LIMIT 50`;

type CsvRow = Record<string, unknown>;

type CsvTable = {
  columns: string[];
  rows: CsvRow[];
  errors: string[];
};

type SortDirection = "asc" | "desc";

type SortState = {
  column: string;
  direction: SortDirection;
} | null;

export function SqlQueryPage() {
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [formError, setFormError] = useState<string | null>(null);
  const runSql = api.query.runSql.useMutation();
  const resultTable = useMemo(() => {
    if (!runSql.data) {
      return null;
    }

    return parseCsvTable(runSql.data.csv, runSql.data.columns);
  }, [runSql.data]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextSql = sql.trim();
    if (!nextSql) {
      setFormError("SQL query is required");
      return;
    }

    setFormError(null);
    runSql.mutate({ sql: nextSql });
  }

  return (
    <main className="container grid gap-6 py-6">
      <div className="flex flex-col gap-2 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">QuestDB</Badge>
          <Badge variant="outline">CSV</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-normal">Query</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 rounded-md border bg-card p-4 shadow-sm">
        <div className="grid gap-2">
          <Label htmlFor="sql-query">SQL</Label>
          <Textarea
            id="sql-query"
            value={sql}
            onChange={(event) => setSql(event.target.value)}
            className="min-h-72 resize-y font-mono text-sm leading-6"
            spellCheck={false}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-h-5 text-sm text-destructive">
            {formError ?? runSql.error?.message ?? null}
          </div>
          <Button type="submit" disabled={runSql.isPending}>
            <Play className="h-4 w-4" />
            {runSql.isPending ? "Running" : "Run query"}
          </Button>
        </div>
      </form>

      <section className="grid gap-3 rounded-md border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <h2 className="text-base font-semibold">Result</h2>
          </div>
          {runSql.data ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{runSql.data.row_count.toLocaleString()} rows</Badge>
              <Badge variant="outline">{runSql.data.columns.length.toLocaleString()} columns</Badge>
            </div>
          ) : null}
        </div>
        {runSql.data && resultTable ? (
          <CsvResultTable table={resultTable} />
        ) : (
          <div className="min-h-80 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Run a query to view results.
          </div>
        )}
      </section>
    </main>
  );
}

function parseCsvTable(csv: string, fallbackColumns: string[]): CsvTable {
  if (!csv.trim()) {
    return { columns: fallbackColumns, rows: [], errors: [] };
  }

  const parsed = Papa.parse<CsvRow>(csv, {
    header: true,
    skipEmptyLines: true
  });

  return {
    columns: parsed.meta.fields?.length ? parsed.meta.fields : fallbackColumns,
    rows: parsed.data,
    errors: parsed.errors.map((error) => error.message)
  };
}

function CsvResultTable({ table }: { table: CsvTable }) {
  const [sortState, setSortState] = useState<SortState>(null);
  const activeSort = sortState && table.columns.includes(sortState.column) ? sortState : null;
  const sortedRows = useMemo(() => {
    if (!activeSort) {
      return table.rows;
    }

    return table.rows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const comparison = compareCellValues(left.row[activeSort.column], right.row[activeSort.column]);

        if (comparison === 0) {
          return left.index - right.index;
        }

        return activeSort.direction === "asc" ? comparison : -comparison;
      })
      .map(({ row }) => row);
  }, [activeSort, table.rows]);

  if (!table.columns.length) {
    return (
      <div className="min-h-80 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        No CSV result returned.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {table.errors.length ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          CSV parsed with {table.errors.length.toLocaleString()} warning{table.errors.length === 1 ? "" : "s"}: {table.errors[0]}
        </div>
      ) : null}
      <div className="min-h-80 max-h-[36rem] overflow-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-muted-foreground">
            <tr>
              {table.columns.map((column, columnIndex) => (
                <th
                  key={`${column}-${columnIndex}`}
                  aria-sort={getColumnAriaSort(activeSort, column)}
                  className="whitespace-nowrap px-3 py-2 text-left font-medium"
                >
                  <button
                    type="button"
                    aria-label={getSortButtonLabel(activeSort, column)}
                    className="-mx-2 flex w-full items-center gap-2 rounded px-2 py-1 text-left transition hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      setSortState((currentSort) => ({
                        column,
                        direction: currentSort?.column === column && currentSort.direction === "asc" ? "desc" : "asc"
                      }));
                    }}
                  >
                    <span className="truncate">{column}</span>
                    <SortIndicator activeSort={activeSort} column={column} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length ? (
              sortedRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t">
                  {table.columns.map((column, columnIndex) => {
                    const cellValue = formatCellValue(row[column]);

                    return (
                      <td key={`${column}-${columnIndex}`} className="max-w-[24rem] whitespace-nowrap px-3 py-2 align-top font-mono text-xs tabular-nums">
                        <span className="block overflow-hidden text-ellipsis" title={cellValue || undefined}>
                          {cellValue}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr className="border-t">
                <td colSpan={table.columns.length} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No rows returned.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortIndicator({ activeSort, column }: { activeSort: SortState; column: string }) {
  if (activeSort?.column !== column) {
    return <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-50" />;
  }

  if (activeSort.direction === "asc") {
    return <ArrowUp aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />;
  }

  return <ArrowDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />;
}

function getColumnAriaSort(activeSort: SortState, column: string): "ascending" | "descending" | "none" {
  if (activeSort?.column !== column) {
    return "none";
  }

  return activeSort.direction === "asc" ? "ascending" : "descending";
}

function getSortButtonLabel(activeSort: SortState, column: string) {
  if (activeSort?.column === column && activeSort.direction === "asc") {
    return `Sort by ${column} descending`;
  }

  return `Sort by ${column} ascending`;
}

function compareCellValues(leftValue: unknown, rightValue: unknown) {
  const left = formatCellValue(leftValue).trim();
  const right = formatCellValue(rightValue).trim();

  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map(formatCellValue).join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}
