#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
INIT_SQL="$REPO_ROOT/db/init.sql"
POSTGRES_CONTAINER_NAME="second-brain-postgres"

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "$COMPOSE_FILE" "$@"
  else
    echo "Docker Compose is required, but neither 'docker compose' nor 'docker-compose' is available here." >&2
    echo "" >&2
    echo "If you are inside an OrbStack Ubuntu machine, either:" >&2
    echo "  1. run this command from your macOS terminal where OrbStack installs Docker/Compose, or" >&2
    echo "  2. expose the macOS Docker CLI inside the OrbStack machine, then retry." >&2
    echo "" >&2
    echo "Quick checks:" >&2
    echo "  command -v docker" >&2
    echo "  docker compose version" >&2
    echo "  command -v docker-compose" >&2
    exit 1
  fi
}

postgres_container_id() {
  docker ps -aq --filter "name=^/${POSTGRES_CONTAINER_NAME}$"
}

start_infra() {
  echo "Starting Postgres and QuestDB..."
  compose up -d postgres questdb
}

start_market_api() {
  echo "Starting QuestDB and Market API..."
  compose up -d questdb market-api
}

wait_for_postgres() {
  echo "Waiting for Postgres to accept connections..."
  for _ in {1..30}; do
    if docker exec "$POSTGRES_CONTAINER_NAME" pg_isready -U postgres -d second_brain >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "Postgres did not become ready in time." >&2
  exit 1
}

apply_schema() {
  echo "Applying initial schema from db/init.sql..."
  docker exec -i "$POSTGRES_CONTAINER_NAME" psql -U postgres -d second_brain < "$INIT_SQL"
}

command="${1:-init}"

case "$command" in
  init)
    start_infra
    wait_for_postgres
    apply_schema
    echo "Database is ready at postgres://postgres:postgres@localhost:5432/second_brain"
    echo "QuestDB is available at http://localhost:9000 and PGWire localhost:8812"
    ;;
  start)
    start_infra
    ;;
  market)
    start_market_api
    ;;
  stop)
    echo "Stopping local Compose services..."
    compose stop
    ;;
  reset)
    echo "Resetting Postgres and QuestDB data..."
    compose down -v
    if [[ -n "$(postgres_container_id)" ]]; then
      docker rm -f "$POSTGRES_CONTAINER_NAME" >/dev/null
    fi
    start_infra
    wait_for_postgres
    apply_schema
    echo "Database has been reset at postgres://postgres:postgres@localhost:5432/second_brain"
    echo "QuestDB has been reset at http://localhost:9000"
    ;;
  *)
    echo "Usage: $0 [init|start|market|stop|reset]" >&2
    exit 1
    ;;
esac
