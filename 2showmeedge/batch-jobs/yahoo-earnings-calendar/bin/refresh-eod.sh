#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PAST_DAYS="14"
FUTURE_DAYS="45"
TIMEZONE="America/New_York"

ARGS=()

usage() {
  cat <<'USAGE'
Usage:
  bash batch-jobs/yahoo-earnings-calendar/bin/refresh-eod.sh [options]

Options:
  --past-days N              Days before today to refresh. Default: 14
  --future-days N            Days after today to refresh. Default: 45
  --timezone NAME            Timezone for today calculation. Default: America/New_York
  --dry-run                  Scrape and write rows without inserting QuestDB.
  --headful                  Show browser windows.
  --no-start-questdb         Do not start QuestDB through Docker Compose.
  --timeout-ms NUMBER        Playwright page timeout.
  --max-attempts NUMBER      Date-level ingest attempts.
  --request-delay-ms NUMBER  Delay between Yahoo page requests.
  --run-root PATH            Run output root.
  -h, --help                 Show this help.
USAGE
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

non_negative_int_arg() {
  local name="$1"
  local value="$2"
  [[ "$value" =~ ^[0-9]+$ ]] || die "$name must be a non-negative integer."
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --past-days)
      PAST_DAYS="${2:-}"
      non_negative_int_arg "--past-days" "$PAST_DAYS"
      shift 2
      ;;
    --future-days)
      FUTURE_DAYS="${2:-}"
      non_negative_int_arg "--future-days" "$FUTURE_DAYS"
      shift 2
      ;;
    --timezone)
      TIMEZONE="${2:-}"
      shift 2
      ;;
    --dry-run|--headful|--no-start-questdb)
      ARGS+=("$1")
      shift
      ;;
    --timeout-ms|--max-attempts|--request-delay-ms|--run-root)
      ARGS+=("$1" "${2:-}")
      shift 2
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

DATE_RANGE="$(
  TZ="$TIMEZONE" node - "$PAST_DAYS" "$FUTURE_DAYS" "$TIMEZONE" <<'JS'
const [pastDaysRaw, futureDaysRaw, timeZone] = process.argv.slice(2);
const pastDays = Number(pastDaysRaw);
const futureDays = Number(futureDaysRaw);

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).formatToParts(new Date());

const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
const todayUtc = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function format(date) {
  return date.toISOString().slice(0, 10);
}

console.log(`${format(addDays(todayUtc, -pastDays))} ${format(addDays(todayUtc, futureDays))}`);
JS
)"

read -r FROM_DATE TO_DATE <<< "$DATE_RANGE"

exec "$SCRIPT_DIR/backfill-range.sh" \
  --from "$FROM_DATE" \
  --to "$TO_DATE" \
  "${ARGS[@]}"

