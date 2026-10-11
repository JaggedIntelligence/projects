#!/usr/bin/env bash

set -euo pipefail

JOB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required. Install uv 0.11.30 from https://docs.astral.sh/uv/getting-started/installation/" >&2
  exit 127
fi

exec uv run \
  --project "$JOB_DIR" \
  --locked \
  python "$JOB_DIR/benzinga.py" "$@"
