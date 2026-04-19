#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

js_files=(
  assets/js/theme.js
  assets/js/runtime-state.js
  assets/js/runtime-storage.js
  assets/js/core.js
  assets/js/navigation.js
  assets/js/tavern.js
  assets/js/checkin.js
  assets/js/phone-achievements.js
  assets/js/tasks.js
  assets/js/notes.js
  assets/js/leave.js
  assets/js/stats.js
  assets/js/status-ui.js
  assets/js/sync.js
  assets/js/shortcuts.js
  assets/js/app-init.js
)

for file in "${js_files[@]}"; do
  node --check "$file"
done

python3 -m py_compile scripts/browser-smoke.py
bash -n scripts/browser-smoke.sh
bash -n scripts/setup-browser-test.sh

required_scripts=(
  "assets/js/runtime-state.js"
  "assets/js/runtime-storage.js"
  "assets/js/shortcuts.js"
  "assets/js/app-init.js"
)

for script_path in "${required_scripts[@]}"; do
  rg -F "$script_path" index.html >/dev/null
done

required_files=(
  "environment.browser-test.yml"
  "scripts/browser-smoke.sh"
  "scripts/browser-smoke.py"
  "scripts/setup-browser-test.sh"
)

for file_path in "${required_files[@]}"; do
  test -f "$file_path"
done

runtime_state_line="$(rg -n 'assets/js/runtime-state.js' index.html | cut -d: -f1)"
runtime_storage_line="$(rg -n 'assets/js/runtime-storage.js' index.html | cut -d: -f1)"
core_line="$(rg -n 'assets/js/core.js' index.html | cut -d: -f1)"
app_init_line="$(rg -n 'assets/js/app-init.js' index.html | cut -d: -f1)"
tavern_line="$(rg -n 'assets/js/tavern.js' index.html | cut -d: -f1)"

if (( runtime_state_line >= runtime_storage_line )); then
  printf 'runtime-state.js must load before runtime-storage.js\n' >&2
  exit 1
fi

if (( runtime_storage_line >= core_line )); then
  printf 'runtime-storage.js must load before core.js\n' >&2
  exit 1
fi

if (( app_init_line >= tavern_line )); then
  printf 'app-init.js must register before tavern.js\n' >&2
  exit 1
fi

required_ids=(
  "nav-checkin"
  "panel-meta-desc"
  "keyboard-shortcut-hint"
  "morning-checkin"
  "toast-container"
)

for element_id in "${required_ids[@]}"; do
  rg -F "id=\"$element_id\"" index.html >/dev/null
done

required_docs=(
  "docs/functional-self-check.md"
)

for doc_path in "${required_docs[@]}"; do
  test -f "$doc_path"
done

printf 'Smoke check passed.\n'
