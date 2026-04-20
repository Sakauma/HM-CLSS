#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST_DIR="$ROOT_DIR/scripts/smoke_manifest"
cd "$ROOT_DIR"

read_manifest() {
  local manifest_path="$1"
  grep -vE '^\s*(#.*)?$' "$manifest_path"
}

check_js_syntax() {
  while IFS= read -r file_path; do
    node --check "$file_path"
  done < <(read_manifest "$MANIFEST_DIR/js-syntax.txt")
}

check_index_references() {
  local manifest_path="$1"

  while IFS= read -r item; do
    rg -F "$item" index.html >/dev/null || {
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
    rg -F "id=\"$element_id\"" index.html >/dev/null || {
      printf 'id="%s" is missing from index.html\n' "$element_id" >&2
      exit 1
    }
  done < <(read_manifest "$MANIFEST_DIR/required-ids.txt")
}

check_script_order() {
  local previous_script=""
  local previous_line=0

  while IFS= read -r script_path; do
    local current_line
    current_line="$(rg -n -F "$script_path" index.html | cut -d: -f1 | head -n 1)"
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

check_js_syntax
node --test tests/unit/*.test.js
python3 -m py_compile scripts/browser-smoke.py
while IFS= read -r -d '' py_file; do
  python3 -m py_compile "$py_file"
done < <(find scripts/browser_smoke -type f -name '*.py' -print0)
bash -n scripts/browser-smoke.sh
bash -n scripts/setup-browser-test.sh

check_script_order
check_index_references "$MANIFEST_DIR/script-order.txt"
check_index_references "$MANIFEST_DIR/required-stylesheets.txt"
check_existing_paths "$MANIFEST_DIR/required-files.txt"
check_existing_paths "$MANIFEST_DIR/required-docs.txt"
check_required_ids

printf 'Smoke check passed.\n'
