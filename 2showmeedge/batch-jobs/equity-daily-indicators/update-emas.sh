#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/scripts/docker-compose.yml"
REBUILD="false"
EMA_ARGS=()

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "$COMPOSE_FILE" "$@"
  else
    echo "Docker Compose is required." >&2
    exit 1
  fi
}

for argument in "$@"; do
  if [[ "$argument" == "--rebuild" ]]; then
    REBUILD="true"
  else
    EMA_ARGS+=("$argument")
  fi
done

cd "$REPO_ROOT"

if [[ "$REBUILD" == "true" ]]; then
  compose build market-api
fi

compose up -d questdb market-api

echo "Waiting for market-api and QuestDB..."
for _ in {1..60}; do
  if compose exec -T market-api python -c \
    "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/questdb/health', timeout=5).read()" \
    >/dev/null 2>&1; then
    compose exec -T market-api python -m app.jobs.update_daily_emas "${EMA_ARGS[@]}"
    exit $?
  fi
  sleep 1
done

compose logs --no-color --tail=120 market-api >&2 || true
echo "market-api or QuestDB did not become healthy in time." >&2
exit 1
