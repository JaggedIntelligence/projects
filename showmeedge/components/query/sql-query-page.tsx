"use client";

import { Database, Play } from "lucide-react";
import { FormEvent, useState } from "react";

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

export function SqlQueryPage() {
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [formError, setFormError] = useState<string | null>(null);
  const runSql = api.query.runSql.useMutation();

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
        <pre className="min-h-80 max-h-[36rem] overflow-auto rounded-md border bg-muted/40 p-4 font-mono text-xs leading-5">{runSql.data?.csv ?? ""}</pre>
      </section>
    </main>
  );
}
