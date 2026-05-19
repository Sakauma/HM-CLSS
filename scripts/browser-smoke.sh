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
CONDA_BIN=""

log_info() {
  printf '[browser-smoke] %s\n' "$*"
}

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

resolve_conda_bin() {
  local candidate
  for candidate in conda conda.exe; do
    if command -v "$candidate" >/dev/null 2>&1; then
      printf '%s\n' "$candidate"
      return
    fi
  done
}

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

CONDA_BIN="$(resolve_conda_bin || true)"
if [[ -z "$CONDA_BIN" ]]; then
  log_info "conda command not found; using browser env python directly"
fi

python_path_arg() {
  if [[ "$ENV_PYTHON" == *.exe && "$1" =~ ^/mnt/([A-Za-z])/(.*)$ ]]; then
    local drive
    local rest
    drive="$(printf '%s' "${BASH_REMATCH[1]}" | tr '[:lower:]' '[:upper:]')"
    rest="${BASH_REMATCH[2]//\//\\}"
    printf '%s:\\%s\n' "$drive" "$rest"
    return
  fi
  printf '%s\n' "$1"
}

python_env_path() {
  if [[ "$ENV_PYTHON" == *.exe ]]; then
    printf '%s;%s;%s;%s\n' \
      "$(python_path_arg "$CONDA_ENV_PATH")" \
      "$(python_path_arg "$CONDA_ENV_PATH/Scripts")" \
      "$(python_path_arg "$CONDA_ENV_PATH/Library/bin")" \
      "$PATH"
    return
  fi
  printf '%s:%s:%s:%s\n' "$CONDA_ENV_PATH" "$CONDA_ENV_PATH/bin" "$CONDA_ENV_PATH/Scripts" "$PATH"
}

run_browser_python() {
  if [[ -n "$CONDA_BIN" ]]; then
    "$CONDA_BIN" run --no-capture-output -p "$CONDA_ENV_PATH" python "$@"
  else
    PATH="$(python_env_path)" "$ENV_PYTHON" "$@"
  fi
}

diagnose_browser_env() {
  run_browser_python - <<'PY'
import shutil
import sys
from pathlib import Path

try:
    import selenium
    selenium_version = selenium.__version__
except Exception as error:
    selenium_version = f"unavailable ({error})"

print(f"[browser-smoke] Python: {sys.version.split()[0]} ({sys.executable})")
print(f"[browser-smoke] Selenium: {selenium_version}")

def resolve_tool(tool_name):
    found = shutil.which(tool_name)
    if found:
        return found
    names = [tool_name]
    if sys.platform.startswith("win") and not tool_name.endswith(".exe"):
        names.insert(0, f"{tool_name}.exe")
    for subdir in ("", "bin", "Scripts", "Library/bin"):
        base = Path(sys.prefix) / subdir if subdir else Path(sys.prefix)
        for name in names:
            candidate = base / name
            if candidate.exists():
                return str(candidate)
    return None

for tool_name in ("firefox", "geckodriver"):
    print(f"[browser-smoke] {tool_name}: {resolve_tool(tool_name) or 'not found'}")
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
  PATH="$(python_env_path)" "$ENV_PYTHON" -m http.server 8000 --directory "$(python_path_arg "$ROOT_DIR")" >"$SERVER_LOG" 2>&1 &
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
if [[ -n "$CONDA_BIN" ]]; then
  exec "$CONDA_BIN" run --no-capture-output -p "$CONDA_ENV_PATH" \
    python "$ROOT_DIR/scripts/browser-smoke.py" \
    --url "$TARGET_URL" \
    --artifact-dir "$ARTIFACT_DIR" \
    --visual-baseline "$ROOT_DIR/tests/fixtures/visual-layout-baselines.json" \
    "$@"
fi

export PATH="$(python_env_path)"
exec "$ENV_PYTHON" "$(python_path_arg "$ROOT_DIR/scripts/browser-smoke.py")" \
  --url "$TARGET_URL" \
  --artifact-dir "$(python_path_arg "$ARTIFACT_DIR")" \
  --visual-baseline "$(python_path_arg "$ROOT_DIR/tests/fixtures/visual-layout-baselines.json")" \
  "$@"
