#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/scripts/docker-compose.yml"

PROVIDER="yfinance"
LOOKBACK_YEARS="ALL"
ALL_SYMBOLS="false"
SYMBOLS=()
SYMBOLS_FILE=""
UNIVERSE=""
MAX_SYMBOLS=""
REBUILD="false"
LOG_ROOT=""

usage() {
  cat <<'USAGE'
Usage:
  bash batch-jobs/stock-seasonality/rebuild-stock-seasonality-safe.sh [options]

Options:
  --symbol SYMBOL              Symbol to rebuild. Can be passed multiple times. Default: AMD
  --symbols-file PATH          Text file with one symbol per line.
  --universe NAME              CSV universe name in market-api app/data.
  --all-symbols                Rebuild every symbol present in equity_ohlcv_daily for the provider.
  --provider NAME              Data provider. Default: yfinance
  --lookback-years VALUE       Lookback window. MVP supports only ALL.
  --max-symbols N              Limit resolved symbols for smoke tests.
  --log-root PATH              Host log root. Default: batch-jobs/stock-seasonality/LOG/showmeedge-seasonality
  --rebuild                    Rebuild market-api image before running.
  -h, --help                   Show this help.

Examples:
  bash batch-jobs/stock-seasonality/rebuild-stock-seasonality-safe.sh --symbol AMD

  bash batch-jobs/stock-seasonality/rebuild-stock-seasonality-safe.sh --all-symbols --provider yfinance

  bash batch-jobs/stock-seasonality/rebuild-stock-seasonality-safe.sh --universe sp500_current --max-symbols 5
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

slug() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
  [[ -n "$value" ]] || value="seasonality"
  printf '%s' "$value"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --symbol)
      SYMBOLS+=("${2:-}")
      shift 2
      ;;
    --symbols-file)
      SYMBOLS_FILE="${2:-}"
      shift 2
      ;;
    --universe)
      UNIVERSE="${2:-}"
      shift 2
      ;;
    --all-symbols)
      ALL_SYMBOLS="true"
      shift
      ;;
    --provider)
      PROVIDER="${2:-}"
      shift 2
      ;;
    --lookback-years)
      LOOKBACK_YEARS="${2:-}"
      shift 2
      ;;
    --max-symbols)
      MAX_SYMBOLS="${2:-}"
      positive_int_arg "--max-symbols" "$MAX_SYMBOLS"
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

[[ -n "$PROVIDER" ]] || die "--provider cannot be empty."
[[ -n "$LOOKBACK_YEARS" ]] || die "--lookback-years cannot be empty."
[[ -f "$COMPOSE_FILE" ]] || die "Compose file not found: $COMPOSE_FILE"
if [[ -n "$SYMBOLS_FILE" ]]; then
  [[ -f "$SYMBOLS_FILE" ]] || die "Symbols file not found: $SYMBOLS_FILE"
fi
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

wait_for_market_api

RUN_ID="$(date +%Y%m%d-%H%M%S)"
LABEL="showmeedge-seasonality-$(slug "$PROVIDER")"
if [[ -z "$LOG_ROOT" ]]; then
  LOG_ROOT="$REPO_ROOT/batch-jobs/stock-seasonality/LOG/$LABEL"
fi

LOG_DIR="$LOG_ROOT/$RUN_ID"
mkdir -p "$LOG_DIR"

CONTAINER_REPORT_PREFIX="/tmp/${LABEL}-${RUN_ID}"
CONTAINER_RUN_SUMMARY_FILE="${CONTAINER_REPORT_PREFIX}-summary.json"
HOST_RUN_SUMMARY_FILE="$LOG_DIR/run-summary.json"
REBUILD_LOG="$LOG_DIR/rebuild.log"
VERIFY_LOG="$LOG_DIR/verification.log"

REBUILD_CMD=(
  python -m app.jobs.rebuild_stock_seasonality
  --provider "$PROVIDER"
  --lookback-years "$LOOKBACK_YEARS"
  --run-summary-file "$CONTAINER_RUN_SUMMARY_FILE"
)

if [[ "$ALL_SYMBOLS" == "true" ]]; then
  REBUILD_CMD+=(--all-symbols)
fi

if [[ -n "$UNIVERSE" ]]; then
  REBUILD_CMD+=(--universe "$UNIVERSE")
fi

if [[ -n "$SYMBOLS_FILE" ]]; then
  REBUILD_CMD+=(--symbols-file "$SYMBOLS_FILE")
fi

if [[ -n "$MAX_SYMBOLS" ]]; then
  REBUILD_CMD+=(--max-symbols "$MAX_SYMBOLS")
fi

for symbol in "${SYMBOLS[@]}"; do
  REBUILD_CMD+=(--symbol "$symbol")
done

echo "Logs: $LOG_DIR"
printf 'Running: docker compose -f %q exec -T market-api' "$COMPOSE_FILE"
printf ' %q' "${REBUILD_CMD[@]}"
printf '\n'

set +e
compose exec -T market-api "${REBUILD_CMD[@]}" 2>&1 | tee "$REBUILD_LOG"
REBUILD_STATUS="${PIPESTATUS[0]}"
set -e

if compose exec -T market-api test -f "$CONTAINER_RUN_SUMMARY_FILE" >/dev/null 2>&1; then
  compose exec -T market-api cat "$CONTAINER_RUN_SUMMARY_FILE" > "$HOST_RUN_SUMMARY_FILE"
  echo "Run summary: $HOST_RUN_SUMMARY_FILE"
fi

echo "Verifying seasonality cache rows..."
compose exec -T -e PROVIDER="$PROVIDER" -e LOOKBACK_YEARS="$LOOKBACK_YEARS" market-api python - <<'PY' | tee "$VERIFY_LOG"
import os

from app.questdb import questdb_connection, sql_literal

provider = os.environ["PROVIDER"].strip().lower()
lookback_years = os.environ["LOOKBACK_YEARS"].strip().upper()

where_clause = f"provider = {sql_literal(provider)} AND lookback_years = {sql_literal(lookback_years)}"

with questdb_connection() as connection:
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT count(), max(as_of_ts) FROM equity_month_seasonality WHERE {where_clause}")
        month_rows, month_as_of = cursor.fetchone()

        cursor.execute(f"SELECT count(), max(as_of_ts) FROM equity_month_trading_day_seasonality WHERE {where_clause}")
        trading_day_rows, trading_day_as_of = cursor.fetchone()

        cursor.execute(f"SELECT count(), max(as_of_ts) FROM equity_month_outcome_seasonality WHERE {where_clause}")
        outcome_rows, outcome_as_of = cursor.fetchone()

print(f"provider={provider}")
print(f"lookback_years={lookback_years}")
print(f"month_seasonality_rows={month_rows}")
print(f"month_seasonality_latest_as_of={month_as_of}")
print(f"trading_day_seasonality_rows={trading_day_rows}")
print(f"trading_day_seasonality_latest_as_of={trading_day_as_of}")
print(f"month_outcome_seasonality_rows={outcome_rows}")
print(f"month_outcome_seasonality_latest_as_of={outcome_as_of}")
PY

if [[ "$REBUILD_STATUS" -ne 0 ]]; then
  echo "Seasonality rebuild finished with failures. See: $REBUILD_LOG" >&2
  exit "$REBUILD_STATUS"
fi

echo "Seasonality rebuild finished successfully."
echo "Rebuild log: $REBUILD_LOG"
echo "Verification log: $VERIFY_LOG"
