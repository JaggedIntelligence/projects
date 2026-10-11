# Benzinga API Data Extraction Design

## 1. Purpose

`benzinga.py` collects Benzinga analyst-rating data from the Massive API and writes one CSV file for each requested stock ticker.

The collector is designed for batch execution. It supports:

- Selecting tickers from a configured symbol universe.
- Restricting collection to specified tickers or a maximum number of symbols.
- Applying an optional inclusive date range.
- Retrying transient API failures.
- Restarting an interrupted or partially failed run without fetching completed tickers again.
- Writing final ticker CSV files atomically.
- Producing checkpoints, event logs, failure lists, record counts, and a run summary.

The program only writes files. It does not insert data into QuestDB or another database.

## 2. Runtime Components

The job consists of these files:

- `benzinga.py`: collector implementation and command-line entry point.
- `run.sh`: launches the collector through the locked `uv` environment.
- `pyproject.toml`: Python project and dependency configuration.
- `uv.lock`: exact dependency versions.
- `tests/test_benzinga.py`: unit and integration-style tests using fake API clients.
- `runs/`: default root directory for run output.

The external runtime dependency is the Massive Python SDK. The API key is read from the `MASSIVE_API_KEY` environment variable.

## 3. High-Level Data Flow

```text
Symbol-universe CSV
        |
        v
Select and normalize tickers
        |
        v
Create run manifest and configuration
        |
        v
For each incomplete ticker
        |
        v
Massive list_benzinga_ratings API
        |
        v
Normalize SDK rating objects to dictionaries
        |
        v
Write temporary JSONL staging data
        |
        v
Discover the union of CSV columns
        |
        v
Remove excluded fields and write temporary CSV
        |
        v
Atomically publish <TICKER>.csv
        |
        v
Write ticker checkpoint
        |
        v
Write record counts and run summary
```

JSONL is used only as temporary per-attempt staging for API records and for operational metadata such as the manifest and event log. No persistent `symbols/<TICKER>.jsonl` files are produced.

## 4. Run Directory Layout

Every new run creates a directory under the configured output root. By default, the path is:

```text
runs/<UTC-run-id>/
```

Example:

```text
runs/20260808T183000Z/
├── AMD.csv
├── AAPL.csv
├── manifest.jsonl
├── run-config.json
├── events.jsonl
├── failed-symbols.jsonl
├── no-data-symbols.jsonl
├── records_per_symbols.json
├── summary.json
└── checkpoints/
    ├── AMD.json
    └── AAPL.json
```

The program does not create a combined `rows.jsonl` file or a persistent `symbols/` directory.

## 5. Symbol-Universe Loading

The default universe is `sp500_current`, loaded from:

```text
services/market-api/app/data/sp500_current.csv
```

The universe can be changed with `--universe` and `--universe-dir`.

The loader:

1. Reads the `symbol` column, falling back to `Symbol`.
2. Trims whitespace and converts each ticker to uppercase.
3. Rejects empty tickers.
4. Rejects duplicate normalized tickers.
5. Retains the security name and universe name in the in-memory manifest record.

The canonical symbol is used instead of provider-specific alternatives such as `provider_symbol`.

## 6. Symbol Selection

By default, all symbols in the universe are selected.

Selection can be narrowed with:

- `--ticker <TICKER>`: selects a ticker and can be repeated.
- `--max-symbols <COUNT>`: limits the selected list after ticker filtering.

Repeated `--ticker` values are deduplicated while preserving the requested order. A requested ticker that is absent from the universe causes the run to stop before API collection begins.

## 7. Run Creation and Identity

A new run receives a UTC identifier formatted as:

```text
YYYYMMDDTHHMMSSZ
```

For example:

```text
20260808T183000Z
```

The identifier can be overridden with `--run-id`.

When a new run starts, the collector writes:

- `manifest.jsonl`: ordered ticker records, including their position and run ID.
- `run-config.json`: immutable API query settings needed to reproduce or resume the run.

If a run directory with the same manifest already exists, the collector refuses to overwrite it and instructs the operator to use `--resume-run`.

## 8. API Query Design

For each ticker, the collector calls:

```python
client.list_benzinga_ratings(...)
```

The base query contains:

- `ticker`: normalized uppercase ticker.
- `limit`: API page size.
- `sort`: `last_updated.asc`.

Optional query fields are:

- `date_gte`: inclusive start date from `--start`.
- `date_lte`: inclusive end date from `--end`.

The page size defaults to `50000`, which is also the maximum accepted by the command-line parser. Pagination is handled by the Massive SDK iterator.

## 9. API Record Normalization

Massive SDK results may be returned as mappings, dataclasses, or regular Python objects. `rating_to_dict()` converts each supported value into a dictionary.

For safety, the response ticker is checked against the requested ticker. If Massive returns a different non-empty ticker, the ticker fetch fails with a collection error instead of writing the mismatched record.

Before temporary staging, an internal `_ingest` object is added:

```json
{
  "source": "massive-benzinga-analyst-ratings",
  "requested_ticker": "AMD",
  "fetched_at": "2026-08-08T18:30:00Z",
  "run_id": "20260808T183000Z"
}
```

This metadata supports internal traceability during processing. It is not included in the final CSV.

Dates, datetimes, and paths are converted to JSON-compatible strings by the shared JSON serializer.

## 10. Temporary JSONL Staging

Records for one ticker are streamed to a hidden temporary file associated with the destination CSV. This staging step has three purposes:

1. It avoids retaining the entire API response in memory.
2. It allows a failed streaming response to be discarded without publishing partial data.
3. It allows the collector to scan all records for the complete set of CSV columns before writing the header.

The staging file is truncated when a retry starts. It is removed after a successful CSV conversion, after the final failed attempt, or when the process handles a keyboard interrupt or system exit.

If the operating system terminates the process without allowing cleanup, a hidden temporary file can remain. It is not treated as a completed ticker because no valid checkpoint is created for it.

## 11. CSV Output Design

The final destination for a ticker is:

```text
runs/<run-id>/<SAFE-TICKER>.csv
```

Examples:

```text
AMD.csv
BRK.B.csv
```

Ticker filenames are normalized to uppercase. Characters outside `A-Z`, `0-9`, `.`, `_`, and `-` are replaced with `_`.

### 11.1 Column Selection

The program scans all staged records for the ticker and constructs the sorted union of their top-level keys. Using the union prevents fields that first appear in later records from being lost.

The following top-level fields are excluded:

- `_ingest`
- `benzinga_calendar_url`
- `benzinga_news_url`

All other top-level fields are written as CSV columns.

Column names are sorted alphabetically to make output deterministic. Different tickers can have different columns if their API responses contain different field sets.

### 11.2 Cell Conversion

CSV cell values are handled as follows:

- `null`/`None` becomes an empty cell.
- Dictionaries, lists, and tuples become compact JSON strings inside the cell.
- Other scalar values are passed to Python's CSV writer.
- The CSV writer handles commas, quotes, and line breaks using standard CSV quoting.

### 11.3 Atomic Publication

CSV output is first written to a hidden temporary CSV file in the same directory. After the complete file has been written successfully, `os.replace()` atomically publishes it as `<TICKER>.csv`.

This prevents consumers from observing a partially written final CSV.

### 11.4 No-Data Symbols

If Massive returns zero records, the collector creates an empty, zero-byte CSV for the ticker. The checkpoint status is `no_data`, and the ticker receives a record count of `0`.

## 12. Retry and Failure Handling

Each ticker fetch can be attempted multiple times. The defaults are:

- Maximum attempts: `3`.
- Base retry delay: `2.0` seconds.
- Delay between ticker requests: `0.25` seconds.

Retry delays use exponential backoff plus jitter:

```text
base_delay * 2^(attempt - 1) + jitter
```

The collector retries:

- HTTP `429` responses.
- HTTP `5xx` responses.
- Transport errors.
- Other unrecognized SDK failures.

It does not retry recognized permanent errors such as:

- Invalid or missing API credentials.
- Unauthorized or forbidden access.
- Missing data entitlement.
- Plan-upgrade requirements.
- Internal `CollectionError` validation failures.

API keys are redacted from logged error messages.

If a response fails after yielding some records, the next attempt truncates the staging file and starts the ticker again. Partial records from the failed attempt cannot be duplicated in the final CSV.

## 13. Checkpoints

After a ticker CSV is successfully published, the collector writes:

```text
checkpoints/<TICKER>.json
```

Example:

```json
{
  "attempts": 1,
  "finished_at": "2026-08-08T18:31:02Z",
  "records": 237,
  "started_at": "2026-08-08T18:30:58Z",
  "status": "succeeded",
  "ticker": "AMD"
}
```

Valid completed statuses are:

- `succeeded`: one or more records were written.
- `no_data`: the API returned zero records.

A checkpoint is considered usable only when both conditions are true:

1. The checkpoint has a completed status.
2. The corresponding ticker CSV exists.

This prevents a missing output file from being treated as completed solely because a checkpoint exists.

## 14. Resume Behavior

An incomplete or failed run can be resumed with:

```bash
bash run.sh --resume-run runs/<run-id>
```

During resume:

1. The existing manifest and run configuration are loaded.
2. The original start date, end date, and page size are restored.
3. Tickers with valid checkpoints and existing CSV files are skipped.
4. Missing or incomplete tickers are fetched again.
5. Run-level reports are regenerated from the current checkpoint state.

To protect consistency, `--resume-run` cannot be combined with ticker filtering, symbol limits, a new run ID, or new date parameters.

## 15. Operational Metadata

### 15.1 `events.jsonl`

The event log records:

- Collection start.
- Failed fetch attempts.
- Successful ticker fetches.
- Final collection summary.

It is append-only so multiple resume invocations remain visible in the same run history.

### 15.2 `failed-symbols.jsonl`

Contains tickers that exhausted their attempts during the latest invocation. Each record includes the attempt count, status code when available, error type, redacted message, and failure time.

### 15.3 `no-data-symbols.jsonl`

Contains completed checkpoints for tickers whose API response contained no records.

### 15.4 `records_per_symbols.json`

Contains the final record count for every completed ticker.

Example:

```json
{
  "AAPL": 184,
  "AMD": 237,
  "MSFT": 0
}
```

No-data tickers are included with `0`. Failed and pending tickers are omitted because their final record counts are unknown.

### 15.5 `summary.json`

Contains run-level information, including:

- Run identity and directory.
- Universe and query parameters.
- Whether the invocation was a resume.
- Total, attempted, completed, no-data, failed, and pending symbol counts.
- Attempts made during the invocation.
- Total records represented by completed checkpoints.
- Overall completion status.
- Invocation start and finish timestamps.

The same summary is appended to `events.jsonl` and printed to standard output.

## 16. Completion Rules and Exit Codes

The run is complete when every manifest ticker has a valid completed checkpoint and its CSV exists.

The command exits with:

- `0`: all manifest tickers are complete.
- `1`: a collection error occurred or some tickers remain incomplete.
- `2`: `MASSIVE_API_KEY` is missing.

## 17. Security Design

The API key is never accepted as a command-line argument and is not written to run artifacts.

It must be supplied through:

```bash
export MASSIVE_API_KEY="..."
```

Avoiding command-line API keys reduces exposure through shell history and process listings. Error messages are passed through a redaction function before being written or displayed.

## 18. Command-Line Interface

Important options include:

| Option | Purpose |
| --- | --- |
| `--universe` | Select the universe CSV name. |
| `--universe-dir` | Override the universe directory. |
| `--ticker` | Select one ticker; repeat for multiple tickers. |
| `--max-symbols` | Limit the selected ticker count. |
| `--start` | Inclusive event start date in `YYYY-MM-DD` format. |
| `--end` | Inclusive event end date in `YYYY-MM-DD` format. |
| `--page-size` | Set the Massive API page size, up to `50000`. |
| `--retry-attempts` | Set the maximum attempts per ticker. |
| `--retry-delay-seconds` | Set the retry base delay. |
| `--request-delay-seconds` | Set the delay between ticker requests. |
| `--output-root` | Override the default `runs/` directory. |
| `--run-id` | Assign a specific identifier to a new run. |
| `--resume-run` | Resume an existing run directory. |
| `--dry-run` | Documents that this collector writes artifacts only; it does not change database state. |

The start date must be earlier than or equal to the end date. Numeric limits and delays are validated before collection begins.

## 19. Testing Strategy

The test suite avoids external API calls by injecting fake clients.

It verifies:

- Canonical universe-symbol loading.
- Requested ticker ordering and limiting.
- Retry classification.
- Restart after a mid-stream API failure without partial duplicates.
- Query construction and inclusive dates.
- Restoration of query settings during resume.
- Per-ticker CSV generation.
- Removal of unwanted CSV fields.
- Preservation of nested values as JSON cell strings.
- Union of fields appearing in different records.
- Empty CSV creation for no-data symbols.
- `records_per_symbols.json` contents.
- Resume skipping for completed tickers.
- Absence of `rows.jsonl` and the persistent `symbols/` directory.

The tests can be run from this job directory with:

```bash
uv run --locked python -m unittest discover -s tests -p 'test_*.py'
```

## 20. Design Tradeoffs

### Temporary JSONL versus in-memory buffering

Temporary JSONL adds a second read of each ticker's records, but it bounds memory usage and makes it possible to construct a complete CSV header before writing rows.

### Per-ticker schemas

Column discovery occurs separately for each ticker. This avoids retaining all ticker data until the end of the run, but tickers can have different CSV headers when the API supplies different fields.

### Empty no-data CSV files

The API does not provide a schema when it returns no records. Therefore, a no-data ticker receives an empty file instead of a header-only file.

### Checkpoint written after CSV

The CSV is published before its checkpoint. If the process terminates in the small interval between these operations, resume will fetch the ticker again because the CSV alone does not prove completion. This favors correctness over avoiding a possible duplicate API request.

## 21. Current Boundaries

The collector intentionally does not:

- Write to a database.
- Merge all tickers into one output file.
- Retain persistent per-ticker JSONL data.
- Enforce one fixed CSV schema across every ticker.
- Infer counts for failed or pending tickers.
- Delete legacy artifacts from runs created by older versions of the collector.

