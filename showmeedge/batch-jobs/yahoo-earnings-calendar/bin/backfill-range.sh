#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JOB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$JOB_DIR/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/scripts/docker-compose.yml"

FROM_DATE=""
TO_DATE=""
RUN_ROOT="$JOB_DIR/runs"
TIMEOUT_MS="60000"
MAX_ATTEMPTS="3"
REQUEST_DELAY_MS="0"
DRY_RUN="false"
HEADFUL="false"
START_QUESTDB="true"

usage() {
  cat <<'USAGE'
Usage:
  bash batch-jobs/yahoo-earnings-calendar/bin/backfill-range.sh --from YYYY-MM-DD --to YYYY-MM-DD [options]

Options:
  --from YYYY-MM-DD          Inclusive requested range start.
  --to YYYY-MM-DD            Inclusive requested range end.
  --run-root PATH            Run output root. Default: batch-jobs/yahoo-earnings-calendar/runs
  --timeout-ms NUMBER        Playwright page timeout. Default: 60000
  --max-attempts NUMBER      Date-level ingest attempts. Default: 3
  --request-delay-ms NUMBER  Delay between Yahoo page requests. Default: 0
  --dry-run                  Scrape and write rows without inserting QuestDB.
  --headful                  Show browser windows.
  --no-start-questdb         Do not start QuestDB through Docker Compose.
  -h, --help                 Show this help.
USAGE
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

date_arg() {
  local name="$1"
  local value="$2"
  [[ "$value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || die "$name must use YYYY-MM-DD format."
}

positive_int_arg() {
  local name="$1"
  local value="$2"
  [[ "$value" =~ ^[0-9]+$ ]] || die "$name must be a positive integer."
  (( value > 0 )) || die "$name must be greater than 0."
}

non_negative_int_arg() {
  local name="$1"
  local value="$2"
  [[ "$value" =~ ^[0-9]+$ ]] || die "$name must be a non-negative integer."
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

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)
      FROM_DATE="${2:-}"
      date_arg "--from" "$FROM_DATE"
      shift 2
      ;;
    --to)
      TO_DATE="${2:-}"
      date_arg "--to" "$TO_DATE"
      shift 2
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
      non_negative_int_arg "--request-delay-ms" "$REQUEST_DELAY_MS"
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

[[ -n "$FROM_DATE" ]] || die "--from is required."
[[ -n "$TO_DATE" ]] || die "--to is required."
[[ "$FROM_DATE" < "$TO_DATE" || "$FROM_DATE" == "$TO_DATE" ]] || die "--from must be less than or equal to --to."

cd "$REPO_ROOT"

if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  source "$REPO_ROOT/.env"
  set +a
fi

LOCK_DIR="/tmp/showmeedge-yahoo-earnings-calendar.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  die "Another yahoo earnings calendar job appears to be running. Lock: $LOCK_DIR"
fi
trap 'rm -rf "$LOCK_DIR"' EXIT

if [[ "$START_QUESTDB" == "true" && "$DRY_RUN" != "true" ]]; then
  [[ -f "$COMPOSE_FILE" ]] || die "Compose file not found: $COMPOSE_FILE"
  command -v docker >/dev/null 2>&1 || die "Docker CLI is required."
  echo "Starting QuestDB..."
  compose up -d questdb
fi

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="$RUN_ROOT/$RUN_ID"
mkdir -p "$RUN_DIR"

MANIFEST_FILE="$RUN_DIR/manifest.jsonl"
GENERATOR_LOG="$RUN_DIR/generate.log"
INGEST_LOG="$RUN_DIR/ingest.stdout.log"

GENERATE_CMD=(
  node batch-jobs/yahoo-earnings-calendar/generate-manifest.mjs
  --from "$FROM_DATE"
  --to "$TO_DATE"
  --output "$MANIFEST_FILE"
  --timeout-ms "$TIMEOUT_MS"
)

INGEST_CMD=(
  node batch-jobs/yahoo-earnings-calendar/ingest-manifest.mjs
  --manifest "$MANIFEST_FILE"
  --max-attempts "$MAX_ATTEMPTS"
  --request-delay-ms "$REQUEST_DELAY_MS"
  --timeout-ms "$TIMEOUT_MS"
)

if [[ "$HEADFUL" == "true" ]]; then
  GENERATE_CMD+=(--headful)
  INGEST_CMD+=(--headful)
fi

if [[ "$DRY_RUN" == "true" ]]; then
  INGEST_CMD+=(--dry-run)
fi

echo "Run directory: $RUN_DIR"
echo "Generating manifest..."
set +e
"${GENERATE_CMD[@]}" 2>&1 | tee "$GENERATOR_LOG"
GENERATE_STATUS="${PIPESTATUS[0]}"
set -e
[[ "$GENERATE_STATUS" -eq 0 ]] || die "Manifest generation failed. See: $GENERATOR_LOG"

echo "Ingesting manifest..."
set +e
"${INGEST_CMD[@]}" 2>&1 | tee "$INGEST_LOG"
INGEST_STATUS="${PIPESTATUS[0]}"
set -e

if [[ "$INGEST_STATUS" -ne 0 ]]; then
  echo "Ingest finished with failures. See: $INGEST_LOG" >&2
  echo "Failed dates: $RUN_DIR/failed-dates.jsonl" >&2
  exit "$INGEST_STATUS"
fi

echo "Backfill finished successfully."
echo "Run directory: $RUN_DIR"

