"use client";

import { Database, Play } from "lucide-react";
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
                <th key={`${column}-${columnIndex}`} className="whitespace-nowrap px-3 py-2 text-left font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.length ? (
              table.rows.map((row, rowIndex) => (
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
