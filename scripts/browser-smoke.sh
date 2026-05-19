#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_URL="http://127.0.0.1:8000"
TARGET_URL="${HM_CLSS_SMOKE_URL:-$DEFAULT_URL}"
CONDA_ENV_PATH="${HM_CLSS_BROWSER_ENV:-$ROOT_DIR/.conda/browser-test}"
ARTIFACT_DIR="${HM_CLSS_BROWSER_ARTIFACT_DIR:-$ROOT_DIR/.artifacts/browser-smoke}"
SERVER_LOG="${HM_CLSS_BROWSER_SERVER_LOG:-$ARTIFACT_DIR/server.log}"
SERVER_PID=""
ENV_PYTHON=""

log_info() {
  printf '[browser-smoke] %s\n' "$*"
}

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

if ! command -v conda >/dev/null 2>&1; then
  printf 'conda is required for browser-smoke.sh\n' >&2
  printf 'PATH: %s\n' "$PATH" >&2
  printf 'Hint: add Miniconda to PATH or set HM_CLSS_BROWSER_ENV to an existing browser-test env.\n' >&2
  exit 1
fi

if [[ -x "$CONDA_ENV_PATH/bin/python" ]]; then
  ENV_PYTHON="$CONDA_ENV_PATH/bin/python"
elif [[ -x "$CONDA_ENV_PATH/python.exe" ]]; then
  ENV_PYTHON="$CONDA_ENV_PATH/python.exe"
else
  printf 'Browser test environment not found at %s\n' "$CONDA_ENV_PATH" >&2
  printf 'Run: bash scripts/setup-browser-test.sh\n' >&2
  printf 'Expected a conda env containing python, selenium, firefox, and geckodriver.\n' >&2
  printf 'Override with HM_CLSS_BROWSER_ENV if the environment lives elsewhere.\n' >&2
  exit 1
fi

diagnose_browser_env() {
  conda run --no-capture-output -p "$CONDA_ENV_PATH" python - <<'PY'
import shutil
import sys

try:
    import selenium
    selenium_version = selenium.__version__
except Exception as error:
    selenium_version = f"unavailable ({error})"

print(f"[browser-smoke] Python: {sys.version.split()[0]} ({sys.executable})")
print(f"[browser-smoke] Selenium: {selenium_version}")
for tool_name in ("firefox", "geckodriver"):
    print(f"[browser-smoke] {tool_name}: {shutil.which(tool_name) or 'not found in PATH'}")
PY
}

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

mkdir -p "$ARTIFACT_DIR"
log_info "Target URL: $TARGET_URL"
log_info "Conda env: $CONDA_ENV_PATH"
log_info "Artifact dir: $ARTIFACT_DIR"
log_info "Static server log: $SERVER_LOG"
diagnose_browser_env

if ! probe_url "$TARGET_URL"; then
  if [[ "$TARGET_URL" != "$DEFAULT_URL" ]]; then
    printf 'Target URL is not reachable: %s\n' "$TARGET_URL" >&2
    printf 'Check HM_CLSS_SMOKE_URL, local firewall/proxy settings, or start the target app manually.\n' >&2
    exit 1
  fi

  mkdir -p "$(dirname "$SERVER_LOG")"
  "$ENV_PYTHON" -m http.server 8000 --directory "$ROOT_DIR" >"$SERVER_LOG" 2>&1 &
  SERVER_PID="$!"
  log_info "Started local static server with pid $SERVER_PID"

  for _ in {1..40}; do
    if probe_url "$TARGET_URL"; then
      break
    fi
    sleep 0.25
  done
fi

if ! probe_url "$TARGET_URL"; then
  printf 'Failed to reach %s after starting a local static server.\n' "$TARGET_URL" >&2
  printf 'Server log: %s\n' "$SERVER_LOG" >&2
  if [[ -f "$SERVER_LOG" ]]; then
    tail -n 40 "$SERVER_LOG" >&2 || true
  fi
  exit 1
fi

log_info "Running Selenium browser smoke scenarios"
exec conda run --no-capture-output -p "$CONDA_ENV_PATH" \
  python "$ROOT_DIR/scripts/browser-smoke.py" \
  --url "$TARGET_URL" \
  --artifact-dir "$ARTIFACT_DIR" \
  --visual-baseline "$ROOT_DIR/tests/fixtures/visual-layout-baselines.json" \
  "$@"
