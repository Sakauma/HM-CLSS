#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_URL="http://127.0.0.1:8000"
TARGET_URL="${HM_CLSS_SMOKE_URL:-$DEFAULT_URL}"
CONDA_ENV_PATH="${HM_CLSS_BROWSER_ENV:-$ROOT_DIR/.conda/browser-test}"
SERVER_PID=""
ENV_PYTHON=""

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

if ! command -v conda >/dev/null 2>&1; then
  printf 'conda is required for browser-smoke.sh\n' >&2
  exit 1
fi

if [[ ! -x "$CONDA_ENV_PATH/bin/python" ]]; then
  printf 'Browser test environment not found at %s\n' "$CONDA_ENV_PATH" >&2
  printf 'Run: bash scripts/setup-browser-test.sh\n' >&2
  printf 'Expected a conda env containing python, selenium, firefox, and geckodriver.\n' >&2
  exit 1
fi

ENV_PYTHON="$CONDA_ENV_PATH/bin/python"

probe_url() {
  "$ENV_PYTHON" - "$1" <<'PY'
import sys
import urllib.request

url = sys.argv[1]
try:
    with urllib.request.urlopen(url, timeout=2) as response:
        status = getattr(response, "status", 200)
        raise SystemExit(0 if 200 <= status < 400 else 1)
except Exception:
    raise SystemExit(1)
PY
}

if ! probe_url "$TARGET_URL"; then
  if [[ "$TARGET_URL" != "$DEFAULT_URL" ]]; then
    printf 'Target URL is not reachable: %s\n' "$TARGET_URL" >&2
    exit 1
  fi

  "$ENV_PYTHON" -m http.server 8000 --directory "$ROOT_DIR" >/tmp/hmclss-browser-smoke.log 2>&1 &
  SERVER_PID="$!"

  for _ in {1..40}; do
    if probe_url "$TARGET_URL"; then
      break
    fi
    sleep 0.25
  done
fi

if ! probe_url "$TARGET_URL"; then
  printf 'Failed to reach %s after starting a local static server.\n' "$TARGET_URL" >&2
  exit 1
fi

exec conda run --no-capture-output -p "$CONDA_ENV_PATH" \
  python "$ROOT_DIR/scripts/browser-smoke.py" --url "$TARGET_URL" "$@"
