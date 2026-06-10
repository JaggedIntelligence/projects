# Feature: Query Stock Data

## Goal

Add a simple protected SQL query screen for inspecting QuestDB market-data tables from the web app.

The first version is intentionally small:

- User opens `/query`.
- User types a SQL query.
- User clicks `Run query`.
- The query is sent to the Python market API.
- FastAPI executes the SQL against QuestDB.
- Results return to the UI as a CSV string.
- The UI parses the CSV string and displays it as a table.
- User can click any result column header to sort the visible table rows by that column.

This feature is an internal data workbench for fast inspection and future CSV-driven workflows.

## Key Design Decision

Keep QuestDB access in the Python market service.

Flow:

```text
Browser
  -> /query page
  -> tRPC query.runSql mutation
  -> FastAPI POST /query/sql
  -> QuestDB PGWire query execution
  -> JSON result returned to Next.js
  -> CSV string parsed by Papa Parse
  -> sortable result table displayed in UI
```

This preserves the current project boundary:

- Next.js owns product UI, auth, app shell, and user workflows.
- tRPC owns the app-facing typed API boundary.
- FastAPI owns QuestDB access.
- QuestDB owns time-series market data.

## MVP Scope

The first implementation keeps the surface simple:

- Protected route at `/query`.
- SQL textarea.
- `Run query` button.
- Loading and error state.
- Parsed CSV result table.
- Clickable result column headers with ascending/descending sort toggle.
- Response metadata for row and column counts.

No advanced SQL editor, table browser, pagination, download button, history, or saved queries are included in this slice.

## Route And Protection

The page lives under the protected app route group:

```text
app/(app)/query/page.tsx
components/query/sql-query-page.tsx
```

Clerk middleware protects `/query`:

```text
middleware.ts
```

The route is also available in the app shell navigation as `Query`.

## UI Design

The `/query` screen is a utilitarian internal tool.

Layout:

```text
Header
  QuestDB badge
  CSV badge
  Query title

SQL form
  textarea
  Run query button
  inline error message

Result section
  row count badge
  column count badge
  parsed CSV table
  sortable column headers
```

Default SQL:

```sql
SELECT ts, symbol, provider, open, high, low, close, volume
FROM equity_ohlcv_daily
WHERE symbol = 'AAPL'
ORDER BY ts DESC
LIMIT 50
```

The API still returns CSV because downstream plans may operate on that string later. The browser parses the string with Papa Parse using the first CSV row as headers and renders the result as a table for easier inspection.

Result table behavior:

- Column order follows the parsed CSV headers.
- Each column header is a button.
- First click on a header sorts ascending.
- Clicking the same header again sorts descending.
- Sorting is local to the displayed result set and does not re-run the SQL query.
- Numeric-looking cell values sort numerically; other values sort as natural text.
- Empty cell values sort after non-empty values.
- The active header exposes `aria-sort` for accessibility.

## tRPC Contract

Router:

```text
server/api/routers/query.ts
```

Procedure:

```text
api.query.runSql
```

Input:

```json
{
  "sql": "SELECT * FROM equity_ohlcv_daily LIMIT 10"
}
```

Output:

```json
{
  "csv": "ts,symbol,provider,open,high,low,close,volume\n...",
  "row_count": 10,
  "columns": ["ts", "symbol", "provider", "open", "high", "low", "close", "volume"]
}
```

The UI parses `csv` for table display and uses `row_count` / `columns.length` for small result badges.

## FastAPI Contract

Endpoint:

```text
POST /query/sql
```

Request:

```json
{
  "sql": "SELECT 1"
}
```

Response:

```json
{
  "csv": "?column?\n1\n",
  "row_count": 1,
  "columns": ["?column?"]
}
```

Implementation path:

```text
services/market-api/app/main.py
services/market-api/app/models.py
```

CSV serialization should use Python's `csv.writer` and cursor metadata:

- `cursor.description` provides column names.
- `cursor.fetchall()` provides result rows.
- `csv.writer` handles escaping and row formatting.

## SQL Behavior

For the MVP, the app assumes the user enters a valid read query.

Current intentional non-goals:

- No DDL/DML keyword checks.
- No table-name restrictions.
- No enforced `LIMIT`.
- No pagination.
- No result-size cap.
- No query rewrite or wrapping.

Any QuestDB error is returned through FastAPI and displayed in the UI as an error message.

## Local Development Note

The Next.js UI calls FastAPI through:

```text
MARKET_API_BASE_URL
```

Default:

```text
http://127.0.0.1:8000
```

After changing FastAPI routes, rebuild or restart the Docker market API service so the container loads the new endpoint:

```bash
docker compose -f scripts/docker-compose.yml up -d --build market-api
```

If `/query` shows `Not Found` after clicking `Run query`, the usual cause is that the running market-api container does not yet include `POST /query/sql`.

Quick endpoint check:

```bash
curl -s -i -X POST http://127.0.0.1:8000/query/sql \
  -H 'content-type: application/json' \
  --data '{"sql":"SELECT 1"}'
```

## Verification

Expected checks for this feature:

```bash
pnpm exec tsc --noEmit
pnpm lint
PYTHONPYCACHEPREFIX=/private/tmp/showmeedge-pycache python3 -m compileall services/market-api/app
PYTHONPYCACHEPREFIX=/private/tmp/showmeedge-pycache PYTHONPATH=services/market-api python3 -m unittest discover services/market-api/tests
```

Browser smoke check:

- Open `/query` while signed out.
- Confirm Clerk redirects to `/sign-in?redirect_url=.../query`.
- Sign in.
- Run the default query.
- Confirm CSV results are displayed as a table.
- Click a column header once and confirm rows sort ascending.
- Click the same column header again and confirm rows sort descending.

## Future Enhancements

Possible next iterations:

- Add a CSV download button.
- Add saved query snippets.
- Add table/schema discovery.
- Add query history.
- Add editor features such as monospace line numbers and SQL highlighting.
- Add optional guardrails for internal production use, such as SELECT-only enforcement or a max row count.
