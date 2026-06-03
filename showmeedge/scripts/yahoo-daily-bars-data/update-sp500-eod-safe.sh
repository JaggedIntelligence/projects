#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/scripts/docker-compose.yml"

UNIVERSE="sp500_current"
LOOKBACK_DAYS="10"
START_DATE=""
END_DATE=""
TIMEZONE="America/New_York"
BATCH_SIZE="10"
RETRY_ATTEMPTS="3"
RETRY_SLEEP_SECONDS="5"
SLEEP_SECONDS="1"
MIN_SYMBOLS="450"
ALLOW_SMALL_UNIVERSE="false"
REBUILD="false"
MAX_SYMBOLS=""
LOG_ROOT="$REPO_ROOT/scripts/LOG/showmeedge-sp500-eod"

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/yahoo-daily-bars-data/update-sp500-eod-safe.sh [options]

Options:
  --universe NAME              CSV universe name in market-api app/data. Default: sp500_current
  --lookback-days N            Calendar days to refresh when --start is omitted. Default: 10
  --start YYYY-MM-DD           Optional inclusive refresh start date. Overrides --lookback-days.
  --end YYYY-MM-DD             Optional inclusive refresh end date. Default: today in --timezone
  --timezone NAME              Timezone used to compute default --end. Default: America/New_York
  --batch-size N               Symbols per yfinance batch. Default: 10
  --max-symbols N              Limit resolved universe for smoke tests.
  --min-symbols N              Minimum universe size required. Default: 450
  --allow-small-universe       Allow running with fewer than --min-symbols.
  --retry-attempts N           Retry attempts for each batch/symbol. Default: 3
  --retry-sleep-seconds N      Sleep between retries. Default: 5
  --sleep-seconds N            Sleep between batches. Default: 1
  --log-root PATH              Host log root. Default: scripts/LOG/showmeedge-sp500-eod
  --rebuild                    Rebuild market-api image before running.
  -h, --help                   Show this help.

Examples:
  bash scripts/yahoo-daily-bars-data/update-sp500-eod-safe.sh --max-symbols 5 --lookback-days 2

  bash scripts/yahoo-daily-bars-data/update-sp500-eod-safe.sh
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

while [[ $# -gt 0 ]]; do
  case "$1" in
    --universe)
      UNIVERSE="${2:-}"
      shift 2
      ;;
    --lookback-days)
      LOOKBACK_DAYS="${2:-}"
      positive_int_arg "--lookback-days" "$LOOKBACK_DAYS"
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
    --timezone)
      TIMEZONE="${2:-}"
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
[[ -n "$LOOKBACK_DAYS" ]] || die "--lookback-days cannot be empty."
[[ -n "$TIMEZONE" ]] || die "--timezone cannot be empty."
if [[ -n "$START_DATE" && -n "$END_DATE" ]]; then
  [[ "$START_DATE" < "$END_DATE" || "$START_DATE" == "$END_DATE" ]] || die "--start must be less than or equal to --end."
fi
[[ -f "$COMPOSE_FILE" ]] || die "Compose file not found: $COMPOSE_FILE"
command -v docker >/dev/null 2>&1 || die "Docker CLI is required."
compose ps >/dev/null 2>&1 || die "Docker Compose is not running or is not reachable."

cd "$REPO_ROOT"

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
  die "Universe has only $SYMBOL_COUNT symbols, below minimum $MIN_SYMBOLS. Refresh the full S&P 500 CSV first or rerun with --allow-small-universe for a smoke test."
fi

RUN_ID="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="$LOG_ROOT/$RUN_ID"
mkdir -p "$LOG_DIR"

CONTAINER_REPORT_PREFIX="/tmp/showmeedge-sp500-eod-${RUN_ID}"
CONTAINER_FAILED_FILE="${CONTAINER_REPORT_PREFIX}-failed.json"
CONTAINER_NO_DATA_FILE="${CONTAINER_REPORT_PREFIX}-no-data.json"
CONTAINER_RUN_SUMMARY_FILE="${CONTAINER_REPORT_PREFIX}-summary.json"
HOST_FAILED_FILE="$LOG_DIR/failed-symbols.json"
HOST_NO_DATA_FILE="$LOG_DIR/no-data-symbols.json"
HOST_RUN_SUMMARY_FILE="$LOG_DIR/run-summary.json"
UPDATE_LOG="$LOG_DIR/update.log"
VERIFY_LOG="$LOG_DIR/verification.log"

UPDATE_CMD=(
  python -m app.jobs.update_daily_recent
  --universe "$UNIVERSE"
  --lookback-days "$LOOKBACK_DAYS"
  --timezone "$TIMEZONE"
  --batch-size "$BATCH_SIZE"
  --retry-attempts "$RETRY_ATTEMPTS"
  --retry-sleep-seconds "$RETRY_SLEEP_SECONDS"
  --sleep-seconds "$SLEEP_SECONDS"
  --failed-symbols-file "$CONTAINER_FAILED_FILE"
  --no-data-symbols-file "$CONTAINER_NO_DATA_FILE"
  --run-summary-file "$CONTAINER_RUN_SUMMARY_FILE"
)

if [[ -n "$START_DATE" ]]; then
  UPDATE_CMD+=(--start "$START_DATE")
fi

if [[ -n "$END_DATE" ]]; then
  UPDATE_CMD+=(--end "$END_DATE")
fi

if [[ -n "$MAX_SYMBOLS" ]]; then
  UPDATE_CMD+=(--max-symbols "$MAX_SYMBOLS")
fi

echo "Logs: $LOG_DIR"
printf 'Running: docker compose -f %q exec -T market-api' "$COMPOSE_FILE"
printf ' %q' "${UPDATE_CMD[@]}"
printf '\n'

set +e
compose exec -T market-api "${UPDATE_CMD[@]}" 2>&1 | tee "$UPDATE_LOG"
UPDATE_STATUS="${PIPESTATUS[0]}"
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

echo "Verifying recent QuestDB coverage..."
compose exec -T -e UNIVERSE="$UNIVERSE" -e MAX_SYMBOLS="$MAX_SYMBOLS" market-api python - <<'PY' | tee "$VERIFY_LOG"
import os
from datetime import datetime

from app.providers.symbols import load_symbol_universe
from app.questdb import questdb_connection

provider = "yfinance"
symbols = [entry.symbol for entry in load_symbol_universe(os.environ["UNIVERSE"])]
if os.environ.get("MAX_SYMBOLS"):
    symbols = symbols[: int(os.environ["MAX_SYMBOLS"])]

with questdb_connection() as connection:
    with connection.cursor() as cursor:
        cursor.execute("SELECT count(), count_distinct(symbol) FROM equity_ohlcv_daily WHERE provider = 'yfinance'")
        total_rows, distinct_symbols = cursor.fetchone()
        print(f"total_yfinance_rows={total_rows}")
        print(f"distinct_yfinance_symbols={distinct_symbols}")

        cursor.execute(
            """
            SELECT symbol, max(ts), count()
            FROM equity_ohlcv_daily
            WHERE provider = 'yfinance'
            GROUP BY symbol
            """
        )
        coverage = {str(symbol): (last_ts, int(row_count or 0)) for symbol, last_ts, row_count in cursor.fetchall()}

latest_ts = max((coverage[symbol][0] for symbol in symbols if symbol in coverage and coverage[symbol][0] is not None), default=None)
missing_latest = [
    symbol
    for symbol in symbols
    if symbol not in coverage or coverage[symbol][0] != latest_ts
]

print(f"requested_symbols={len(symbols)}")
print(f"latest_requested_ts={latest_ts}")
print(f"requested_symbols_with_latest_ts={len(symbols) - len(missing_latest)}")
print(f"requested_symbols_missing_latest_ts={len(missing_latest)}")
if missing_latest:
    print("missing_latest_symbols=" + ",".join(missing_latest[:100]))
PY

if [[ "$UPDATE_STATUS" -ne 0 ]]; then
  echo "EOD update finished with failures. See: $UPDATE_LOG" >&2
  if [[ -f "$HOST_FAILED_FILE" ]]; then
    echo "Rerun failed symbols after reviewing: $HOST_FAILED_FILE" >&2
  fi
  if [[ -f "$HOST_RUN_SUMMARY_FILE" ]]; then
    echo "Run summary: $HOST_RUN_SUMMARY_FILE" >&2
  fi
  exit "$UPDATE_STATUS"
fi

echo "EOD update finished successfully."
echo "Update log: $UPDATE_LOG"
echo "Verification log: $VERIFY_LOG"
if [[ -f "$HOST_RUN_SUMMARY_FILE" ]]; then
  echo "Run summary: $HOST_RUN_SUMMARY_FILE"
fi
if [[ -f "$HOST_NO_DATA_FILE" ]]; then
  echo "No-data symbol report: $HOST_NO_DATA_FILE"
fi
