#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JOB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$JOB_DIR/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/scripts/docker-compose.yml"

UNIVERSE="sp500_current"
PROGRAM_ID="yahoo-finance-compare-to"
RECORD_INSERT_FLAG="skip"
RUN_ROOT="$JOB_DIR/runs"
TIMEOUT_MS="60000"
MAX_ATTEMPTS="3"
REQUEST_DELAY_MS="0"
RETRY_DELAY_MS="5000"
HEADFUL="false"
DRY_RUN="false"
START_QUESTDB="true"
MAX_SYMBOLS=""
MIN_SYMBOLS="450"
ALLOW_SMALL_UNIVERSE="false"
TICKER=""

usage() {
  cat <<'USAGE'
Usage:
  bash batch-jobs/industry-peers/bin/backfill-sp500-peers.sh [options]

Options:
  --universe NAME                    CSV universe name in market-api app/data. Default: sp500_current
  --program-id VALUE                 Program/source id. Default: yahoo-finance-compare-to
  --record_insert_flag skip|newrecord Insert policy. Default: skip
  --record-insert-flag skip|newrecord Alias for --record_insert_flag
  --ticker SYMBOL                    Run one source ticker from the selected universe.
  --max-symbols N                    Limit source tickers for smoke tests.
  --min-symbols N                    Minimum universe size required. Default: 450
  --allow-small-universe             Allow running with fewer than --min-symbols.
  --run-root PATH                    Run output root. Default: batch-jobs/industry-peers/runs
  --timeout-ms NUMBER                Playwright page timeout. Default: 60000
  --max-attempts NUMBER              Source-ticker attempts. Default: 3
  --request-delay-ms NUMBER          Delay between source tickers. Default: 0
  --retry-delay-ms NUMBER            Delay after failed attempts. Default: 5000
  --dry-run                          Scrape and write rows without querying or inserting QuestDB.
  --headful                          Show browser windows.
  --no-start-questdb                 Do not start QuestDB through Docker Compose.
  -h, --help                         Show this help.

Examples:
  bash batch-jobs/industry-peers/bin/backfill-sp500-peers.sh

  bash batch-jobs/industry-peers/bin/backfill-sp500-peers.sh \
    --max-symbols 20 \
    --allow-small-universe \
    --dry-run

  bash batch-jobs/industry-peers/bin/backfill-sp500-peers.sh \
    --record_insert_flag newrecord
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

record_insert_flag_arg() {
  local value="$1"
  [[ "$value" == "skip" || "$value" == "newrecord" ]] || die "--record_insert_flag must be skip or newrecord."
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --universe)
      UNIVERSE="${2:-}"
      shift 2
      ;;
    --program-id)
      PROGRAM_ID="${2:-}"
      shift 2
      ;;
    --record_insert_flag|--record-insert-flag)
      RECORD_INSERT_FLAG="${2:-}"
      record_insert_flag_arg "$RECORD_INSERT_FLAG"
      shift 2
      ;;
    --ticker)
      TICKER="${2:-}"
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
    --run-root)
      RUN_ROOT="${2:-}"
      shift 2
      ;;
    --timeout-ms)
      TIMEOUT_MS="${2:-}"
      positive_int_arg "--timeout-ms" "$TIMEOUT_MS"
      shift 2
      ;;
    --max-attempts)
      MAX_ATTEMPTS="${2:-}"
      positive_int_arg "--max-attempts" "$MAX_ATTEMPTS"
      shift 2
      ;;
    --request-delay-ms)
      REQUEST_DELAY_MS="${2:-}"
      non_negative_number_arg "--request-delay-ms" "$REQUEST_DELAY_MS"
      shift 2
      ;;
    --retry-delay-ms)
      RETRY_DELAY_MS="${2:-}"
      non_negative_number_arg "--retry-delay-ms" "$RETRY_DELAY_MS"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --headful)
      HEADFUL="true"
      shift
      ;;
    --no-start-questdb)
      START_QUESTDB="false"
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
[[ -n "$PROGRAM_ID" ]] || die "--program-id cannot be empty."
record_insert_flag_arg "$RECORD_INSERT_FLAG"

cd "$REPO_ROOT"

if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  source "$REPO_ROOT/.env"
  set +a
fi

LOCK_DIR="/tmp/showmeedge-industry-peers.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  die "Another industry peers job appears to be running. Lock: $LOCK_DIR"
fi
trap 'rm -rf "$LOCK_DIR"' EXIT

if [[ "$START_QUESTDB" == "true" && "$DRY_RUN" != "true" ]]; then
  [[ -f "$COMPOSE_FILE" ]] || die "Compose file not found: $COMPOSE_FILE"
  command -v docker >/dev/null 2>&1 || die "Docker CLI is required."
  echo "Starting QuestDB..."
  compose up -d questdb
fi

SYMBOL_COUNT="$(
  UNIVERSE="$UNIVERSE" node --input-type=module -e 'import { loadSymbolUniverse } from "./batch-jobs/industry-peers/lib/symbols.mjs"; console.log((await loadSymbolUniverse(process.env.UNIVERSE)).length);'
)"
SYMBOL_COUNT="${SYMBOL_COUNT//$'\r'/}"

echo "Universe $UNIVERSE contains $SYMBOL_COUNT symbols."
if [[ "$ALLOW_SMALL_UNIVERSE" != "true" && "$SYMBOL_COUNT" -lt "$MIN_SYMBOLS" ]]; then
  die "Universe has only $SYMBOL_COUNT symbols, below minimum $MIN_SYMBOLS. Refresh the full S&P 500 CSV first or rerun with --allow-small-universe for a smoke test."
fi

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
SNAPSHOT_TS="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
RUN_DIR="$RUN_ROOT/$RUN_ID"
mkdir -p "$RUN_DIR"

MANIFEST_FILE="$RUN_DIR/manifest.jsonl"
GENERATOR_LOG="$RUN_DIR/generate.log"
INGEST_LOG="$RUN_DIR/ingest.stdout.log"

GENERATE_CMD=(
  node batch-jobs/industry-peers/generate-manifest.mjs
  --universe "$UNIVERSE"
  --output "$MANIFEST_FILE"
)

if [[ -n "$TICKER" ]]; then
  GENERATE_CMD+=(--ticker "$TICKER")
fi

if [[ -n "$MAX_SYMBOLS" ]]; then
  GENERATE_CMD+=(--max-symbols "$MAX_SYMBOLS")
fi

INGEST_CMD=(
  node batch-jobs/industry-peers/ingest-manifest.mjs
  --manifest "$MANIFEST_FILE"
  --program-id "$PROGRAM_ID"
  --record_insert_flag "$RECORD_INSERT_FLAG"
  --run-id "$RUN_ID"
  --snapshot-ts "$SNAPSHOT_TS"
  --max-attempts "$MAX_ATTEMPTS"
  --request-delay-ms "$REQUEST_DELAY_MS"
  --retry-delay-ms "$RETRY_DELAY_MS"
  --timeout-ms "$TIMEOUT_MS"
)

if [[ "$HEADFUL" == "true" ]]; then
  INGEST_CMD+=(--headful)
fi

if [[ "$DRY_RUN" == "true" ]]; then
  INGEST_CMD+=(--dry-run)
fi

echo "Run directory: $RUN_DIR"
echo "Generating source ticker manifest..."
set +e
"${GENERATE_CMD[@]}" 2>&1 | tee "$GENERATOR_LOG"
GENERATE_STATUS="${PIPESTATUS[0]}"
set -e
[[ "$GENERATE_STATUS" -eq 0 ]] || die "Manifest generation failed. See: $GENERATOR_LOG"

echo "Ingesting industry peers..."
set +e
"${INGEST_CMD[@]}" 2>&1 | tee "$INGEST_LOG"
INGEST_STATUS="${PIPESTATUS[0]}"
set -e

if [[ "$INGEST_STATUS" -ne 0 ]]; then
  echo "Ingest finished with failures. See: $INGEST_LOG" >&2
  echo "Failed source tickers: $RUN_DIR/failed-symbols.jsonl" >&2
  exit "$INGEST_STATUS"
fi

echo "Industry peers backfill finished successfully."
echo "Run directory: $RUN_DIR"
