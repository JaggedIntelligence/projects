#!/usr/bin/env bash
set -euo pipefail

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
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

start_postgres() {
  echo "Starting Postgres..."
  compose up -d postgres
}

wait_for_postgres() {
  echo "Waiting for Postgres to accept connections..."
  for _ in {1..30}; do
    if compose exec -T postgres pg_isready -U postgres -d second_brain >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "Postgres did not become ready in time." >&2
  exit 1
}

apply_schema() {
  echo "Applying initial schema from db/init.sql..."
  compose exec -T postgres psql -U postgres -d second_brain < db/init.sql
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
    compose stop postgres
    ;;
  reset)
    echo "Resetting Postgres data..."
    compose down -v
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
