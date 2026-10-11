#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/scripts/docker-compose.yml"

UNIVERSE="sp500_current"
START_DATE="2010-01-01"
END_DATE=""
BATCH_SIZE="10"
RETRY_ATTEMPTS="3"
RETRY_SLEEP_SECONDS="5"
SLEEP_SECONDS="1"
MIN_SYMBOLS="450"
ALLOW_SMALL_UNIVERSE="false"
REBUILD="false"
MAX_SYMBOLS=""
LOG_ROOT=""

usage() {
  cat <<'USAGE'
Usage:
  bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh [options]

Options:
  --universe NAME              CSV universe name in market-api app/data. Default: sp500_current
  --start YYYY-MM-DD           Backfill start date. Default: 2010-01-01
  --end YYYY-MM-DD             Inclusive backfill end date. Default: latest available from provider
  --batch-size N               Symbols per yfinance batch. Default: 10
  --max-symbols N              Limit resolved universe for smoke tests.
  --min-symbols N              Minimum universe size required. Default: 450
  --allow-small-universe       Allow running with fewer than --min-symbols.
  --retry-attempts N           Retry attempts for each batch/symbol. Default: 3
  --retry-sleep-seconds N      Sleep between retries. Default: 5
  --sleep-seconds N            Sleep between batches. Default: 1
  --log-root PATH              Host log root. Default: LOG/showmeedge-<universe>-backfill
  --rebuild                    Rebuild market-api image before running.
  -h, --help                   Show this help.

Examples:
  bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh --allow-small-universe --max-symbols 20

  bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh --rebuild

  bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh --start 2015-01-01 --end 2020-12-31

  bash batch-jobs/yahoo-daily-bars-data/backfill-sp500-safe.sh --universe forex_major_pairs --allow-small-universe --rebuild
USAGE
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "$COMPOSE_FILE" "$@"
  else
    die "Docker Compose is required, but neither 'docker compose' nor 'docker-compose' is available."
  fi
}

positive_int_arg() {
  local name="$1"
  local value="$2"
  [[ "$value" =~ ^[0-9]+$ ]] || die "$name must be a positive integer."
  (( value > 0 )) || die "$name must be greater than 0."
}

non_negative_number_arg() {
  local name="$1"
  local value="$2"
  [[ "$value" =~ ^[0-9]+([.][0-9]+)?$ ]] || die "$name must be a non-negative number."
}

date_arg() {
  local name="$1"
  local value="$2"
  [[ "$value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || die "$name must use YYYY-MM-DD format."
}

universe_slug() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
  if [[ "$value" == "sp500-current" ]]; then
    value="sp500"
  fi
  [[ -n "$value" ]] || value="universe"
  printf '%s' "$value"
}

run_label() {
  local slug
  slug="$(universe_slug "$1")"
  printf 'showmeedge-%s-%s' "$slug" "$2"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --universe)
      UNIVERSE="${2:-}"
      shift 2
      ;;
    --start)
      START_DATE="${2:-}"
      date_arg "--start" "$START_DATE"
      shift 2
      ;;
    --end)
      END_DATE="${2:-}"
      date_arg "--end" "$END_DATE"
      shift 2
      ;;
    --batch-size)
      BATCH_SIZE="${2:-}"
      positive_int_arg "--batch-size" "$BATCH_SIZE"
      shift 2
      ;;
    --max-symbols)
      MAX_SYMBOLS="${2:-}"
      positive_int_arg "--max-symbols" "$MAX_SYMBOLS"
      shift 2
      ;;
    --min-symbols)
      MIN_SYMBOLS="${2:-}"
      positive_int_arg "--min-symbols" "$MIN_SYMBOLS"
      shift 2
      ;;
    --allow-small-universe)
      ALLOW_SMALL_UNIVERSE="true"
      shift
      ;;
    --retry-attempts)
      RETRY_ATTEMPTS="${2:-}"
      positive_int_arg "--retry-attempts" "$RETRY_ATTEMPTS"
      shift 2
      ;;
    --retry-sleep-seconds)
      RETRY_SLEEP_SECONDS="${2:-}"
      non_negative_number_arg "--retry-sleep-seconds" "$RETRY_SLEEP_SECONDS"
      shift 2
      ;;
    --sleep-seconds)
      SLEEP_SECONDS="${2:-}"
      non_negative_number_arg "--sleep-seconds" "$SLEEP_SECONDS"
      shift 2
      ;;
    --log-root)
      LOG_ROOT="${2:-}"
      shift 2
      ;;
    --rebuild)
      REBUILD="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

[[ -n "$UNIVERSE" ]] || die "--universe cannot be empty."
[[ -n "$START_DATE" ]] || die "--start cannot be empty."
if [[ -n "$END_DATE" ]]; then
  [[ "$START_DATE" < "$END_DATE" || "$START_DATE" == "$END_DATE" ]] || die "--start must be less than or equal to --end."
fi
[[ -f "$COMPOSE_FILE" ]] || die "Compose file not found: $COMPOSE_FILE"
command -v docker >/dev/null 2>&1 || die "Docker CLI is required."
compose ps >/dev/null 2>&1 || die "Docker Compose is not running or is not reachable."

cd "$REPO_ROOT"

RUN_LABEL="$(run_label "$UNIVERSE" "backfill")"
if [[ -z "$LOG_ROOT" ]]; then
  LOG_ROOT="$REPO_ROOT/batch-jobs/yahoo-daily-bars-data/LOG/$RUN_LABEL"
fi

if [[ "$REBUILD" == "true" ]]; then
  echo "Rebuilding market-api image..."
  compose build market-api
fi

echo "Starting QuestDB and market-api..."
compose up -d questdb market-api

wait_for_market_api() {
  echo "Waiting for market-api and QuestDB health checks..."
  for _ in {1..60}; do
    if compose exec -T market-api python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=5).read(); urllib.request.urlopen('http://127.0.0.1:8000/questdb/health', timeout=5).read()" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  compose logs --no-color --tail=120 market-api >&2 || true
  die "market-api or QuestDB did not become healthy in time."
}

universe_count() {
  compose exec -T -e UNIVERSE="$UNIVERSE" market-api python -c 'import os; from app.providers.symbols import load_symbol_universe; print(len(load_symbol_universe(os.environ["UNIVERSE"])))' | tr -d '\r'
}

wait_for_market_api

SYMBOL_COUNT="$(universe_count)"
echo "Universe $UNIVERSE contains $SYMBOL_COUNT symbols."
if [[ "$ALLOW_SMALL_UNIVERSE" != "true" && "$SYMBOL_COUNT" -lt "$MIN_SYMBOLS" ]]; then
  die "Universe has only $SYMBOL_COUNT symbols, below minimum $MIN_SYMBOLS. Rerun with --allow-small-universe or lower --min-symbols for smaller universes."
fi

RUN_ID="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="$LOG_ROOT/$RUN_ID"
mkdir -p "$LOG_DIR"

CONTAINER_REPORT_PREFIX="/tmp/${RUN_LABEL}-${RUN_ID}"
CONTAINER_FAILED_FILE="${CONTAINER_REPORT_PREFIX}-failed.json"
CONTAINER_NO_DATA_FILE="${CONTAINER_REPORT_PREFIX}-no-data.json"
CONTAINER_RUN_SUMMARY_FILE="${CONTAINER_REPORT_PREFIX}-summary.json"
HOST_FAILED_FILE="$LOG_DIR/failed-symbols.json"
HOST_NO_DATA_FILE="$LOG_DIR/no-data-symbols.json"
HOST_RUN_SUMMARY_FILE="$LOG_DIR/run-summary.json"
BACKFILL_LOG="$LOG_DIR/backfill.log"
VERIFY_LOG="$LOG_DIR/verification.log"

BACKFILL_CMD=(
  python -m app.jobs.backfill_daily
  --universe "$UNIVERSE"
  --start "$START_DATE"
  --batch-size "$BATCH_SIZE"
  --skip-existing
  --retry-attempts "$RETRY_ATTEMPTS"
  --retry-sleep-seconds "$RETRY_SLEEP_SECONDS"
  --sleep-seconds "$SLEEP_SECONDS"
  --failed-symbols-file "$CONTAINER_FAILED_FILE"
  --no-data-symbols-file "$CONTAINER_NO_DATA_FILE"
  --run-summary-file "$CONTAINER_RUN_SUMMARY_FILE"
)

if [[ -n "$MAX_SYMBOLS" ]]; then
  BACKFILL_CMD+=(--max-symbols "$MAX_SYMBOLS")
fi

if [[ -n "$END_DATE" ]]; then
  BACKFILL_CMD+=(--end "$END_DATE")
fi

echo "Logs: $LOG_DIR"
printf 'Running: docker compose -f %q exec -T market-api' "$COMPOSE_FILE"
printf ' %q' "${BACKFILL_CMD[@]}"
printf '\n'

set +e
compose exec -T market-api "${BACKFILL_CMD[@]}" 2>&1 | tee "$BACKFILL_LOG"
BACKFILL_STATUS="${PIPESTATUS[0]}"
set -e

copy_container_report() {
  local container_file="$1"
  local host_file="$2"
  local label="$3"

  if compose exec -T market-api test -f "$container_file" >/dev/null 2>&1; then
    compose exec -T market-api cat "$container_file" > "$host_file"
    echo "$label: $host_file"
  fi
}

copy_container_report "$CONTAINER_FAILED_FILE" "$HOST_FAILED_FILE" "Failed-symbol report"
copy_container_report "$CONTAINER_NO_DATA_FILE" "$HOST_NO_DATA_FILE" "No-data symbol report"
copy_container_report "$CONTAINER_RUN_SUMMARY_FILE" "$HOST_RUN_SUMMARY_FILE" "Run summary"

echo "Verifying QuestDB coverage for $UNIVERSE..."
compose exec -T -e UNIVERSE="$UNIVERSE" -e MAX_SYMBOLS="$MAX_SYMBOLS" market-api python - <<'PY' | tee "$VERIFY_LOG"
import os

from app.providers.symbols import load_symbol_universe
from app.questdb import questdb_connection, sql_literal

provider = "yfinance"
universe = os.environ["UNIVERSE"]
symbols = [entry.symbol for entry in load_symbol_universe(universe)]
if os.environ.get("MAX_SYMBOLS"):
    symbols = symbols[: int(os.environ["MAX_SYMBOLS"])]

symbol_list = ", ".join(sql_literal(symbol) for symbol in symbols)
where_clause = f"provider = {sql_literal(provider)} AND symbol IN ({symbol_list})"

with questdb_connection() as connection:
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT count(), count_distinct(symbol), min(ts), max(ts)
            FROM equity_ohlcv_daily
            WHERE {where_clause}
            """
        )
        total_rows, distinct_symbols, first_ts, last_ts = cursor.fetchone()

        cursor.execute(
            f"""
            SELECT symbol, min(ts), max(ts), count()
            FROM equity_ohlcv_daily
            WHERE {where_clause}
            GROUP BY symbol
            ORDER BY symbol
            """
        )
        coverage = {
            str(symbol): (first_symbol_ts, last_symbol_ts, int(row_count or 0))
            for symbol, first_symbol_ts, last_symbol_ts, row_count in cursor.fetchall()
        }

missing_symbols = [symbol for symbol in symbols if symbol not in coverage]

print(f"requested_universe={universe}")
print(f"requested_symbols={len(symbols)}")
print(f"requested_yfinance_rows={total_rows}")
print(f"requested_distinct_symbols={distinct_symbols}")
print(f"requested_start_ts={first_ts}")
print(f"requested_end_ts={last_ts}")
print(f"requested_symbols_with_rows={len(symbols) - len(missing_symbols)}")
print(f"requested_symbols_missing_rows={len(missing_symbols)}")
if missing_symbols:
    print("missing_symbols=" + ",".join(missing_symbols[:100]))

for symbol in symbols[:20]:
    if symbol in coverage:
        first_symbol_ts, last_symbol_ts, row_count = coverage[symbol]
        print(f"{symbol}: rows={row_count} start={first_symbol_ts} end={last_symbol_ts}")
    else:
        print(f"{symbol}: rows=0 start=None end=None")
PY

if [[ "$BACKFILL_STATUS" -ne 0 ]]; then
  echo "Backfill finished with failures. See: $BACKFILL_LOG" >&2
  if [[ -f "$HOST_FAILED_FILE" ]]; then
    echo "Rerun failed symbols after reviewing: $HOST_FAILED_FILE" >&2
  fi
  if [[ -f "$HOST_RUN_SUMMARY_FILE" ]]; then
    echo "Run summary: $HOST_RUN_SUMMARY_FILE" >&2
  fi
  exit "$BACKFILL_STATUS"
fi

echo "Backfill finished successfully."
echo "Backfill log: $BACKFILL_LOG"
echo "Verification log: $VERIFY_LOG"
if [[ -f "$HOST_RUN_SUMMARY_FILE" ]]; then
  echo "Run summary: $HOST_RUN_SUMMARY_FILE"
fi
if [[ -f "$HOST_NO_DATA_FILE" ]]; then
  echo "No-data symbol report: $HOST_NO_DATA_FILE"
fi
