#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST_DIR="$ROOT_DIR/scripts/smoke_manifest"
cd "$ROOT_DIR"

resolve_python_bin() {
  if [[ -n "${PYTHON_BIN:-}" ]]; then
    "$PYTHON_BIN" -c 'import sys' >/dev/null 2>&1 || {
      printf 'PYTHON_BIN is set but not runnable: %s\n' "$PYTHON_BIN" >&2
      exit 1
    }
    printf '%s\n' "$PYTHON_BIN"
    return
  fi

  local candidate
  for candidate in python3 python py; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys' >/dev/null 2>&1; then
      printf '%s\n' "$candidate"
      return
    fi
  done

  printf 'python3 or python is required for smoke-check.sh\n' >&2
  exit 1
}

resolve_node_bin() {
  if [[ -n "${NODE_BIN:-}" ]]; then
    "$NODE_BIN" --version >/dev/null 2>&1 || {
      printf 'NODE_BIN is set but not runnable: %s\n' "$NODE_BIN" >&2
      exit 1
    }
    printf '%s\n' "$NODE_BIN"
    return
  fi

  local candidate
  for candidate in node.exe node; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" --version >/dev/null 2>&1; then
      "$candidate" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' >/dev/null 2>&1 || continue
      printf '%s\n' "$candidate"
      return
    fi
  done

  printf 'Node.js 18 or newer is required for smoke-check.sh\n' >&2
  exit 1
}

read_manifest() {
  local manifest_path="$1"
  grep -vE '^\s*(#.*)?$' "$manifest_path" | sed 's/\r$//'
}

manifest_contains_item() {
  local manifest_path="$1"
  local item="$2"
  read_manifest "$manifest_path" | grep -Fx -- "$item" >/dev/null
}

check_tracked_manifest_freshness() {
  local manifest_path="$1"
  local label="$2"
  local tracked_path="$3"
  local include_regex="$4"
  local exclude_regex="${5:-^$}"
  local missing=()

  if ! command -v git >/dev/null 2>&1; then
    printf 'git is required for manifest freshness checks\n' >&2
    exit 1
  fi

  while IFS= read -r file_path; do
    [[ "$file_path" =~ $include_regex ]] || continue
    [[ "$file_path" =~ $exclude_regex ]] && continue
    if ! manifest_contains_item "$manifest_path" "$file_path"; then
      missing+=("$file_path")
    fi
  done < <(git ls-files "$tracked_path")

  if (( ${#missing[@]} > 0 )); then
    printf '%s is missing tracked files:\n' "$label" >&2
    printf '  %s\n' "${missing[@]}" >&2
    printf 'Update %s so smoke checks cover newly added files.\n' "$manifest_path" >&2
    exit 1
  fi
}

check_manifest_freshness() {
  check_tracked_manifest_freshness "$MANIFEST_DIR/js-syntax.txt" "JavaScript syntax manifest" "assets/js" '\.js$'
  check_tracked_manifest_freshness "$MANIFEST_DIR/required-stylesheets.txt" "Stylesheet manifest" "assets/css" '\.css$'
  check_tracked_manifest_freshness "$MANIFEST_DIR/required-files.txt" "Browser smoke Python manifest" "scripts/browser_smoke" '\.py$' '(^|/)__init__\.py$'
}

check_js_syntax() {
  while IFS= read -r file_path; do
    "$NODE_BIN" --check "$file_path"
  done < <(read_manifest "$MANIFEST_DIR/js-syntax.txt")
}

check_index_references() {
  local manifest_path="$1"

  while IFS= read -r item; do
    grep -F -- "$item" index.html >/dev/null || {
      printf '%s is missing from index.html\n' "$item" >&2
      exit 1
    }
  done < <(read_manifest "$manifest_path")
}

check_existing_paths() {
  local manifest_path="$1"

  while IFS= read -r item; do
    test -f "$item" || {
      printf '%s is missing from the repository\n' "$item" >&2
      exit 1
    }
  done < <(read_manifest "$manifest_path")
}

check_required_ids() {
  while IFS= read -r element_id; do
    grep -F -- "id=\"$element_id\"" index.html >/dev/null || {
      printf 'id="%s" is missing from index.html\n' "$element_id" >&2
      exit 1
    }
  done < <(read_manifest "$MANIFEST_DIR/required-ids.txt")
}

check_vendor_checksums() {
  while read -r expected_hash file_path; do
    [[ -n "$expected_hash" && -n "$file_path" ]] || continue
    test -f "$file_path" || {
      printf '%s is missing from the repository\n' "$file_path" >&2
      exit 1
    }
    local actual_hash
    actual_hash="$(perl -0pe 's/\r\n/\n/g' "$file_path" | shasum -a 256 | awk '{print $1}')"
    if [[ "$actual_hash" != "$expected_hash" ]]; then
      printf '%s checksum mismatch\nexpected: %s\nactual:   %s\n' "$file_path" "$expected_hash" "$actual_hash" >&2
      exit 1
    fi
  done < <(read_manifest "$MANIFEST_DIR/vendor-checksums.txt")
}

check_script_order() {
  local previous_script=""
  local previous_line=0

  while IFS= read -r script_path; do
    local current_line
    current_line="$(grep -n -F -- "$script_path" index.html | cut -d: -f1 | head -n 1)"
    if [[ -z "$current_line" ]]; then
      printf '%s is missing from index.html\n' "$script_path" >&2
      exit 1
    fi

    if [[ -n "$previous_script" ]] && (( previous_line >= current_line )); then
      printf '%s must load before %s\n' "$previous_script" "$script_path" >&2
      exit 1
    fi

    previous_script="$script_path"
    previous_line="$current_line"
  done < <(read_manifest "$MANIFEST_DIR/script-order.txt")
}

check_script_manifest_exact() {
  local expected_scripts
  local actual_scripts

  expected_scripts="$(read_manifest "$MANIFEST_DIR/script-order.txt")"
  actual_scripts="$(awk '
    /HM_CLSS_SCRIPT_BLOCK_START/ { capture = 1; next }
    /HM_CLSS_SCRIPT_BLOCK_END/ { capture = 0 }
    capture { print }
  ' index.html | sed -nE 's/.*<script src="([^"]+)"><\/script>.*/\1/p')"

  if [[ "$expected_scripts" != "$actual_scripts" ]]; then
    printf 'index.html script block does not match scripts/smoke_manifest/script-order.txt\n' >&2
    diff -u <(printf '%s\n' "$expected_scripts") <(printf '%s\n' "$actual_scripts") >&2 || true
    exit 1
  fi
}

PYTHON_BIN="$(resolve_python_bin)"
NODE_BIN="$(resolve_node_bin)"

check_manifest_freshness
check_js_syntax
"$NODE_BIN" scripts/check-module-dependencies.js
"$NODE_BIN" --test tests/unit/*.test.js
"$PYTHON_BIN" -m py_compile scripts/browser-smoke.py
while IFS= read -r -d '' py_file; do
  "$PYTHON_BIN" -m py_compile "$py_file"
done < <(find scripts/browser_smoke -type f -name '*.py' -print0)
bash -n scripts/browser-smoke.sh
bash -n scripts/setup-browser-test.sh

check_script_order
check_script_manifest_exact
check_index_references "$MANIFEST_DIR/script-order.txt"
check_index_references "$MANIFEST_DIR/required-stylesheets.txt"
check_existing_paths "$MANIFEST_DIR/required-files.txt"
check_existing_paths "$MANIFEST_DIR/required-docs.txt"
check_required_ids
check_vendor_checksums

printf 'Smoke check passed.\n'
