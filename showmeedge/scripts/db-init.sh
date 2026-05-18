#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
INIT_SQL="$REPO_ROOT/db/init.sql"
CONTAINER_NAME="second-brain-postgres"

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
  docker ps -aq --filter "name=^/${CONTAINER_NAME}$"
}

start_postgres() {
  local container_id
  container_id="$(postgres_container_id)"

  if [[ -n "$container_id" ]]; then
    echo "Starting existing Postgres container..."
    docker start "$CONTAINER_NAME" >/dev/null
    return
  fi

  echo "Starting Postgres..."
  compose up -d postgres
}

wait_for_postgres() {
  echo "Waiting for Postgres to accept connections..."
  for _ in {1..30}; do
    if docker exec "$CONTAINER_NAME" pg_isready -U postgres -d second_brain >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "Postgres did not become ready in time." >&2
  exit 1
}

apply_schema() {
  echo "Applying initial schema from db/init.sql..."
  docker exec -i "$CONTAINER_NAME" psql -U postgres -d second_brain < "$INIT_SQL"
}

command="${1:-init}"

case "$command" in
  init)
    start_postgres
    wait_for_postgres
    apply_schema
    echo "Database is ready at postgres://postgres:postgres@localhost:5432/second_brain"
    ;;
  start)
    start_postgres
    ;;
  stop)
    echo "Stopping Postgres..."
    if [[ -n "$(postgres_container_id)" ]]; then
      docker stop "$CONTAINER_NAME" >/dev/null
    else
      echo "Postgres container is not present."
    fi
    ;;
  reset)
    echo "Resetting Postgres data..."
    compose down -v
    if [[ -n "$(postgres_container_id)" ]]; then
      docker rm -f "$CONTAINER_NAME" >/dev/null
    fi
    start_postgres
    wait_for_postgres
    apply_schema
    echo "Database has been reset at postgres://postgres:postgres@localhost:5432/second_brain"
    ;;
  *)
    echo "Usage: $0 [init|start|stop|reset]" >&2
    exit 1
    ;;
esac
