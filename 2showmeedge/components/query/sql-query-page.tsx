"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Database, Play, Save } from "lucide-react";
import Papa from "papaparse";
import { FormEvent, useMemo, useState } from "react";

import { api } from "@/components/providers/trpc-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const DEFAULT_SQL = `SELECT ts, symbol, provider, open, high, low, close, volume
FROM equity_ohlcv_daily
WHERE symbol = 'AAPL'
ORDER BY ts DESC
LIMIT 50`;

const SQL_PARAM_COUNT = 4;
const DATE_TIME_CELL_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const NUMERIC_CELL_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

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

type CellPresentation = {
  className?: string;
  columnKind?: "percent";
  sign?: "positive" | "negative" | "zero";
  text: string;
};

export function SqlQueryPage() {
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [sqlParams, setSqlParams] = useState(createEmptySqlParams);
  const [queryName, setQueryName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [selectedSavedQueryId, setSelectedSavedQueryId] = useState<string | null>(null);
  const utils = api.useUtils();
  const savedQueries = api.query.savedQueries.list.useQuery();
  const runSql = api.query.runSql.useMutation();
  const saveQuery = api.query.savedQueries.save.useMutation({
    onSuccess: async (savedQuery) => {
      setSelectedSavedQueryId(savedQuery.id);
      setQueryName(savedQuery.name);
      setSql(savedQuery.sql);
      setSaveMessage(savedQuery.action === "created" ? "Saved query created." : "Saved query updated.");
      await utils.query.savedQueries.list.invalidate();
    }
  });
  const resultTable = useMemo(() => {
    if (!runSql.data) {
      return null;
    }

    return parseCsvTable(runSql.data.csv, runSql.data.columns);
  }, [runSql.data]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextSql = sql.trim();
    if (nextSql.length < 5) {
      setFormError("SQL query must be at least 5 characters");
      return;
    }

    const { error, params } = buildSqlParams(sqlParams);
    if (error) {
      setFormError(error);
      return;
    }

    setFormError(null);
    runSql.mutate({ sql: nextSql, params });
  }

  function handleSaveQuery() {
    setSaveMessage(null);

    const nextName = queryName.trim();
    const nextSql = sql.trim();

    if (nextName.length < 5) {
      setFormError("Query name must be at least 5 characters");
      return;
    }

    if (nextSql.length < 5) {
      setFormError("SQL query must be at least 5 characters");
      return;
    }

    setFormError(null);
    saveQuery.mutate({ name: nextName, sql: nextSql });
  }

  function handleSelectSavedQuery(savedQueryId: string) {
    const savedQuery = savedQueries.data?.find((query) => query.id === savedQueryId);
    if (!savedQuery) {
      return;
    }

    setSelectedSavedQueryId(savedQuery.id);
    setQueryName(savedQuery.name);
    setSql(savedQuery.sql);
    setSqlParams(createEmptySqlParams());
    setFormError(null);
    setSaveMessage(`Loaded "${savedQuery.name}".`);
  }

  return (
    <main className="container grid gap-6 py-6">
      <div className="flex flex-col gap-3 border-b pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">QuestDB</Badge>
              <Badge variant="outline">CSV</Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-normal">Query</h1>
          </div>
          <div className="w-full sm:w-72">
            <Select
              value={selectedSavedQueryId ?? ""}
              onValueChange={handleSelectSavedQuery}
              disabled={savedQueries.isLoading || !savedQueries.data?.length}
            >
              <SelectTrigger aria-label="Saved queries">
                <SelectValue placeholder={savedQueries.isLoading ? "Loading saved queries" : "Saved queries"} />
              </SelectTrigger>
              <SelectContent>
                {(savedQueries.data ?? []).map((savedQuery) => (
                  <SelectItem key={savedQuery.id} value={savedQuery.id}>
                    {savedQuery.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 rounded-md border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="grid gap-2">
            <Label htmlFor="saved-query-name">Query name</Label>
            <Input
              id="saved-query-name"
              value={queryName}
              onChange={(event) => setQueryName(event.target.value)}
              placeholder="My saved query"
            />
          </div>
          <Button type="button" variant="outline" onClick={handleSaveQuery} disabled={saveQuery.isPending}>
            <Save className="h-4 w-4" />
            {saveQuery.isPending ? "Saving" : "Save query as"}
          </Button>
        </div>

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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sqlParams.map((value, index) => (
            <div key={index} className="grid gap-2">
              <Label htmlFor={`sql-param-${index + 1}`}>Parameter ${formatSqlParamLabel(index)}</Label>
              <Input
                id={`sql-param-${index + 1}`}
                aria-label={`Parameter ${formatSqlParamLabel(index)}`}
                value={value}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSqlParams((currentParams) =>
                    currentParams.map((currentValue, currentIndex) =>
                      currentIndex === index ? nextValue : currentValue
                    )
                  );
                }}
                autoComplete="off"
                placeholder={formatSqlParamLabel(index)}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-h-5 text-sm text-destructive">
            {formError ?? saveQuery.error?.message ?? runSql.error?.message ?? savedQueries.error?.message ?? null}
          </div>
          <Button type="submit" disabled={runSql.isPending}>
            <Play className="h-4 w-4" />
            {runSql.isPending ? "Running" : "Run query"}
          </Button>
        </div>
        {saveMessage ? <div className="text-sm text-muted-foreground">{saveMessage}</div> : null}
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

function createEmptySqlParams() {
  return Array.from({ length: SQL_PARAM_COUNT }, () => "");
}

function buildSqlParams(values: string[]): { error: string | null; params: string[] } {
  const trimmedValues = values.map((value) => value.trim());
  let highestFilledIndex = -1;

  for (let index = trimmedValues.length - 1; index >= 0; index -= 1) {
    if (trimmedValues[index]) {
      highestFilledIndex = index;
      break;
    }
  }

  if (highestFilledIndex === -1) {
    return { error: null, params: [] };
  }

  for (let index = 0; index <= highestFilledIndex; index += 1) {
    if (!trimmedValues[index]) {
      return {
        error: `Parameter ${formatSqlParamLabel(index)} is required when ${formatSqlParamLabel(highestFilledIndex)} is filled.`,
        params: []
      };
    }
  }

  return { error: null, params: trimmedValues.slice(0, highestFilledIndex + 1) };
}

function formatSqlParamLabel(index: number) {
  return `$${index + 1}`;
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
                    const rawCellValue = row[column];
                    const cell = getCellPresentation(rawCellValue, column);

                    return (
                      <td key={`${column}-${columnIndex}`} className="max-w-[24rem] whitespace-nowrap px-3 py-2 align-top font-mono text-xs tabular-nums">
                        <span
                          className={cn("block overflow-hidden text-ellipsis", cell.className)}
                          data-column-kind={cell.columnKind}
                          data-value-sign={cell.sign}
                          title={cell.text || undefined}
                        >
                          {cell.text}
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
  const leftNumber = getNumericCellValue(leftValue);
  const rightNumber = getNumericCellValue(rightValue);

  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber - rightNumber;
  }

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

  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function formatCellValue(value: unknown, column?: string): string {
  return getCellPresentation(value, column).text;
}

function getCellPresentation(value: unknown, column?: string): CellPresentation {
  if (column && isPercentColumn(column)) {
    const percentValue = getNumericCellValue(value);
    if (percentValue !== null) {
      const sign = getNumberSign(percentValue);

      return {
        className: getNumberToneClass(sign),
        columnKind: "percent",
        sign,
        text: `${percentValue.toFixed(2)}%`
      };
    }
  }

  if (column && isDateColumn(column)) {
    const dateValue = getDateCellValue(value);
    if (dateValue) {
      return { text: dateValue };
    }
  }

  const numericValue = getNumericCellValue(value);
  if (numericValue !== null) {
    return { text: numericValue.toFixed(2) };
  }

  if (value === null || value === undefined) {
    return { text: "" };
  }

  if (Array.isArray(value)) {
    return { text: value.map((item) => getCellPresentation(item).text).join(", ") };
  }

  if (typeof value === "object") {
    return { text: JSON.stringify(value) };
  }

  return { text: String(value) };
}

function isPercentColumn(column: string) {
  return column.trim().toLowerCase().includes("pct");
}

function getNumberSign(value: number): "positive" | "negative" | "zero" {
  if (value > 0) {
    return "positive";
  }

  if (value < 0) {
    return "negative";
  }

  return "zero";
}

function getNumberToneClass(sign: "positive" | "negative" | "zero") {
  if (sign === "positive") {
    return "font-medium text-emerald-600 dark:text-emerald-400";
  }

  if (sign === "negative") {
    return "font-medium text-rose-600 dark:text-rose-400";
  }

  return undefined;
}

function isDateColumn(column: string) {
  const normalizedColumn = column.trim().toLowerCase();

  return (
    normalizedColumn === "date" ||
    normalizedColumn === "dt" ||
    normalizedColumn === "ts" ||
    normalizedColumn === "time" ||
    normalizedColumn === "timestamp" ||
    normalizedColumn.endsWith("_date") ||
    normalizedColumn.endsWith("_dt") ||
    normalizedColumn.endsWith("_ts") ||
    normalizedColumn.endsWith("_time") ||
    normalizedColumn.endsWith("_timestamp") ||
    normalizedColumn.endsWith("_at")
  );
}

function getDateCellValue(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value !== "string") {
    return null;
  }

  const matchedDate = value.trim().match(DATE_TIME_CELL_PATTERN);

  return matchedDate?.[1] ?? null;
}

function getNumericCellValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim().replace(/%$/, "").replace(/,/g, "");
  if (!trimmedValue || !NUMERIC_CELL_PATTERN.test(trimmedValue)) {
    return null;
  }

  const numericValue = Number(trimmedValue);

  return Number.isFinite(numericValue) ? numericValue : null;
}
