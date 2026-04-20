#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

js_files=(
  assets/js/runtime/theme.js
  assets/js/runtime/store.js
  assets/js/runtime/state.js
  assets/js/runtime/storage-migrations.js
  assets/js/runtime/storage-payload.js
  assets/js/runtime/storage-shapes.js
  assets/js/runtime/storage.js
  assets/js/runtime/date-utils.js
  assets/js/runtime/dom-utils.js
  assets/js/runtime/ambient.js
  assets/js/runtime/module-registry.js
  assets/js/workspace/metrics.js
  assets/js/workspace/data.js
  assets/js/ui/navigation.js
  assets/js/features/tavern/catalog.js
  assets/js/features/tavern/analyze.js
  assets/js/features/tavern/records.js
  assets/js/features/tavern/logic.js
  assets/js/features/tavern/stage.js
  assets/js/features/tavern/result.js
  assets/js/features/tavern/history.js
  assets/js/features/tavern/ui.js
  assets/js/features/tavern/index.js
  assets/js/features/checkin/rules.js
  assets/js/features/checkin/status.js
  assets/js/features/checkin/retro.js
  assets/js/features/checkin/summary.js
  assets/js/features/checkin/ui.js
  assets/js/features/checkin/index.js
  assets/js/features/focus/achievements.js
  assets/js/workspace/entries.js
  assets/js/features/tasks/hero.js
  assets/js/features/tasks/index.js
  assets/js/features/notes/modal.js
  assets/js/features/notes/render.js
  assets/js/features/notes/index.js
  assets/js/features/leave/rules.js
  assets/js/features/leave/ui.js
  assets/js/features/leave/index.js
  assets/js/features/stats/ranges.js
  assets/js/features/stats/aggregates.js
  assets/js/features/stats/data.js
  assets/js/features/stats/charts.js
  assets/js/features/stats/index.js
  assets/js/features/dashboard/copy.js
  assets/js/features/dashboard/confirm.js
  assets/js/features/dashboard/toast.js
  assets/js/features/dashboard/status.js
  assets/js/features/dashboard/ui.js
  assets/js/features/sync/state.js
  assets/js/features/sync/api.js
  assets/js/features/sync/ui.js
  assets/js/features/sync/logic.js
  assets/js/features/sync/index.js
  assets/js/features/export/profiles.js
  assets/js/features/export/monthly.js
  assets/js/features/export/data.js
  assets/js/features/export/formats.js
  assets/js/features/export/ui.js
  assets/js/features/export/index.js
  assets/js/ui/shortcuts.js
  assets/js/runtime/app-init.js
)

for file in "${js_files[@]}"; do
  node --check "$file"
done

node --test tests/unit/*.test.js
python3 -m py_compile scripts/browser-smoke.py
while IFS= read -r -d '' py_file; do
  python3 -m py_compile "$py_file"
done < <(find scripts/browser_smoke -type f -name '*.py' -print0)
bash -n scripts/browser-smoke.sh
bash -n scripts/setup-browser-test.sh

required_scripts=(
  "assets/js/runtime/store.js"
  "assets/js/runtime/state.js"
  "assets/js/runtime/storage-migrations.js"
  "assets/js/runtime/storage-payload.js"
  "assets/js/runtime/storage-shapes.js"
  "assets/js/runtime/storage.js"
  "assets/js/runtime/date-utils.js"
  "assets/js/runtime/dom-utils.js"
  "assets/js/runtime/ambient.js"
  "assets/js/workspace/metrics.js"
  "assets/js/runtime/module-registry.js"
  "assets/js/workspace/data.js"
  "assets/js/features/tavern/catalog.js"
  "assets/js/features/tavern/analyze.js"
  "assets/js/features/tavern/records.js"
  "assets/js/features/tavern/logic.js"
  "assets/js/features/tavern/stage.js"
  "assets/js/features/tavern/result.js"
  "assets/js/features/tavern/history.js"
  "assets/js/features/tavern/ui.js"
  "assets/js/features/checkin/rules.js"
  "assets/js/features/checkin/status.js"
  "assets/js/features/checkin/retro.js"
  "assets/js/features/checkin/summary.js"
  "assets/js/features/checkin/ui.js"
  "assets/js/features/leave/rules.js"
  "assets/js/features/leave/ui.js"
  "assets/js/features/stats/ranges.js"
  "assets/js/features/stats/aggregates.js"
  "assets/js/workspace/entries.js"
  "assets/js/features/tasks/hero.js"
  "assets/js/features/notes/modal.js"
  "assets/js/features/notes/render.js"
  "assets/js/features/sync/state.js"
  "assets/js/features/sync/api.js"
  "assets/js/features/sync/ui.js"
  "assets/js/features/sync/logic.js"
  "assets/js/features/export/profiles.js"
  "assets/js/features/export/monthly.js"
  "assets/js/features/export/data.js"
  "assets/js/features/export/formats.js"
  "assets/js/features/export/ui.js"
  "assets/js/ui/shortcuts.js"
  "assets/js/runtime/app-init.js"
  "assets/js/features/stats/data.js"
  "assets/js/features/stats/charts.js"
  "assets/js/features/dashboard/copy.js"
  "assets/js/features/dashboard/confirm.js"
  "assets/js/features/dashboard/toast.js"
  "assets/js/features/dashboard/status.js"
  "assets/js/features/export/index.js"
)

for script_path in "${required_scripts[@]}"; do
  rg -F "$script_path" index.html >/dev/null
done

required_stylesheets=(
  "assets/css/theme.css"
  "assets/css/shell.css"
  "assets/css/components.css"
  "assets/css/features.css"
  "assets/css/features-notes.css"
  "assets/css/motion.css"
)

for stylesheet_path in "${required_stylesheets[@]}"; do
  rg -F "$stylesheet_path" index.html >/dev/null
done

required_files=(
  "assets/css/theme.css"
  "assets/css/shell.css"
  "assets/css/components.css"
  "assets/css/features.css"
  "assets/css/features-notes.css"
  "assets/css/motion.css"
  ".github/workflows/ci.yml"
  "environment.browser-test.yml"
  "scripts/browser-smoke.sh"
  "scripts/browser-smoke.py"
  "scripts/browser_smoke/helpers.py"
  "scripts/browser_smoke/driver.py"
  "scripts/browser_smoke/scenarios/bootstrap.py"
  "scripts/browser_smoke/scenarios/insights.py"
  "scripts/browser_smoke/scenarios/sync.py"
  "scripts/browser_smoke/scenarios/workspace.py"
  "scripts/browser_smoke/scenarios/accessibility.py"
  "scripts/browser_smoke/scenarios/tavern.py"
  "scripts/setup-browser-test.sh"
  "tests/unit/runtime-and-logic.test.js"
  "tests/unit/tavern-logic.test.js"
  "tests/unit/sync-and-registry.test.js"
  "tests/unit/statistics-and-export.test.js"
)

for file_path in "${required_files[@]}"; do
  test -f "$file_path"
done

runtime_store_line="$(rg -n 'assets/js/runtime/store.js' index.html | cut -d: -f1)"
runtime_state_line="$(rg -n 'assets/js/runtime/state.js' index.html | cut -d: -f1)"
runtime_storage_migrations_line="$(rg -n 'assets/js/runtime/storage-migrations.js' index.html | cut -d: -f1)"
runtime_storage_payload_line="$(rg -n 'assets/js/runtime/storage-payload.js' index.html | cut -d: -f1)"
runtime_storage_shapes_line="$(rg -n 'assets/js/runtime/storage-shapes.js' index.html | cut -d: -f1)"
runtime_storage_line="$(rg -n 'assets/js/runtime/storage.js' index.html | cut -d: -f1)"
date_utils_line="$(rg -n 'assets/js/runtime/date-utils.js' index.html | cut -d: -f1)"
dom_utils_line="$(rg -n 'assets/js/runtime/dom-utils.js' index.html | cut -d: -f1)"
ambient_line="$(rg -n 'assets/js/runtime/ambient.js' index.html | cut -d: -f1)"
module_registry_line="$(rg -n 'assets/js/runtime/module-registry.js' index.html | cut -d: -f1)"
metrics_line="$(rg -n 'assets/js/workspace/metrics.js' index.html | cut -d: -f1)"
workspace_data_line="$(rg -n 'assets/js/workspace/data.js' index.html | cut -d: -f1)"
app_init_line="$(rg -n 'assets/js/runtime/app-init.js' index.html | cut -d: -f1)"
tavern_catalog_line="$(rg -n 'assets/js/features/tavern/catalog.js' index.html | cut -d: -f1)"
tavern_analyze_line="$(rg -n 'assets/js/features/tavern/analyze.js' index.html | cut -d: -f1)"
tavern_records_line="$(rg -n 'assets/js/features/tavern/records.js' index.html | cut -d: -f1)"
tavern_logic_line="$(rg -n 'assets/js/features/tavern/logic.js' index.html | cut -d: -f1)"
tavern_stage_line="$(rg -n 'assets/js/features/tavern/stage.js' index.html | cut -d: -f1)"
tavern_result_line="$(rg -n 'assets/js/features/tavern/result.js' index.html | cut -d: -f1)"
tavern_history_line="$(rg -n 'assets/js/features/tavern/history.js' index.html | cut -d: -f1)"
tavern_ui_line="$(rg -n 'assets/js/features/tavern/ui.js' index.html | cut -d: -f1)"
tavern_line="$(rg -n 'assets/js/features/tavern/index.js' index.html | cut -d: -f1)"
checkin_rules_line="$(rg -n 'assets/js/features/checkin/rules.js' index.html | cut -d: -f1)"
checkin_status_line="$(rg -n 'assets/js/features/checkin/status.js' index.html | cut -d: -f1)"
checkin_retro_line="$(rg -n 'assets/js/features/checkin/retro.js' index.html | cut -d: -f1)"
checkin_summary_line="$(rg -n 'assets/js/features/checkin/summary.js' index.html | cut -d: -f1)"
checkin_ui_line="$(rg -n 'assets/js/features/checkin/ui.js' index.html | cut -d: -f1)"
checkin_line="$(rg -n 'assets/js/features/checkin/index.js' index.html | cut -d: -f1)"
workspace_entries_line="$(rg -n 'assets/js/workspace/entries.js' index.html | cut -d: -f1)"
task_hero_line="$(rg -n 'assets/js/features/tasks/hero.js' index.html | cut -d: -f1)"
tasks_line="$(rg -n 'assets/js/features/tasks/index.js' index.html | cut -d: -f1)"
notes_line="$(rg -n 'assets/js/features/notes/index.js' index.html | cut -d: -f1)"
notes_modal_line="$(rg -n 'assets/js/features/notes/modal.js' index.html | cut -d: -f1)"
notes_render_line="$(rg -n 'assets/js/features/notes/render.js' index.html | cut -d: -f1)"
leave_rules_line="$(rg -n 'assets/js/features/leave/rules.js' index.html | cut -d: -f1)"
leave_ui_line="$(rg -n 'assets/js/features/leave/ui.js' index.html | cut -d: -f1)"
leave_line="$(rg -n 'assets/js/features/leave/index.js' index.html | cut -d: -f1)"
stats_ranges_line="$(rg -n 'assets/js/features/stats/ranges.js' index.html | cut -d: -f1)"
stats_aggregates_line="$(rg -n 'assets/js/features/stats/aggregates.js' index.html | cut -d: -f1)"
stats_data_line="$(rg -n 'assets/js/features/stats/data.js' index.html | cut -d: -f1)"
stats_charts_line="$(rg -n 'assets/js/features/stats/charts.js' index.html | cut -d: -f1)"
stats_line="$(rg -n 'assets/js/features/stats/index.js' index.html | cut -d: -f1)"
status_copy_line="$(rg -n 'assets/js/features/dashboard/copy.js' index.html | cut -d: -f1)"
status_confirm_line="$(rg -n 'assets/js/features/dashboard/confirm.js' index.html | cut -d: -f1)"
status_toast_line="$(rg -n 'assets/js/features/dashboard/toast.js' index.html | cut -d: -f1)"
status_status_line="$(rg -n 'assets/js/features/dashboard/status.js' index.html | cut -d: -f1)"
status_ui_line="$(rg -n 'assets/js/features/dashboard/ui.js' index.html | cut -d: -f1)"
sync_state_line="$(rg -n 'assets/js/features/sync/state.js' index.html | cut -d: -f1)"
sync_api_line="$(rg -n 'assets/js/features/sync/api.js' index.html | cut -d: -f1)"
sync_ui_line="$(rg -n 'assets/js/features/sync/ui.js' index.html | cut -d: -f1)"
sync_logic_line="$(rg -n 'assets/js/features/sync/logic.js' index.html | cut -d: -f1)"
sync_line="$(rg -n 'assets/js/features/sync/index.js' index.html | cut -d: -f1)"
export_profiles_line="$(rg -n 'assets/js/features/export/profiles.js' index.html | cut -d: -f1)"
export_monthly_line="$(rg -n 'assets/js/features/export/monthly.js' index.html | cut -d: -f1)"
export_data_line="$(rg -n 'assets/js/features/export/data.js' index.html | cut -d: -f1)"
export_formats_line="$(rg -n 'assets/js/features/export/formats.js' index.html | cut -d: -f1)"
export_ui_line="$(rg -n 'assets/js/features/export/ui.js' index.html | cut -d: -f1)"
export_line="$(rg -n 'assets/js/features/export/index.js' index.html | cut -d: -f1)"

if (( runtime_store_line >= runtime_state_line )); then
  printf 'runtime/store.js must load before runtime/state.js\n' >&2
  exit 1
fi

if (( runtime_state_line >= runtime_storage_migrations_line )); then
  printf 'runtime-state.js must load before runtime-storage-migrations.js\n' >&2
  exit 1
fi

if (( runtime_storage_migrations_line >= runtime_storage_payload_line )); then
  printf 'runtime-storage-migrations.js must load before runtime-storage-payload.js\n' >&2
  exit 1
fi

if (( runtime_storage_payload_line >= runtime_storage_shapes_line )); then
  printf 'runtime-storage-payload.js must load before runtime-storage-shapes.js\n' >&2
  exit 1
fi

if (( runtime_storage_shapes_line >= runtime_storage_line )); then
  printf 'runtime-storage-shapes.js must load before runtime-storage.js\n' >&2
  exit 1
fi

if (( runtime_storage_line >= date_utils_line )); then
  printf 'runtime-storage.js must load before date-utils.js\n' >&2
  exit 1
fi

if (( date_utils_line >= dom_utils_line )); then
  printf 'date-utils.js must load before dom-utils.js\n' >&2
  exit 1
fi

if (( dom_utils_line >= ambient_line )); then
  printf 'dom-utils.js must load before ambient.js\n' >&2
  exit 1
fi

if (( ambient_line >= module_registry_line )); then
  printf 'ambient.js must load before module-registry.js\n' >&2
  exit 1
fi

if (( module_registry_line >= metrics_line )); then
  printf 'module-registry.js must load before workspace-metrics.js\n' >&2
  exit 1
fi

if (( metrics_line >= workspace_data_line )); then
  printf 'workspace-metrics.js must load before workspace-data.js\n' >&2
  exit 1
fi

if (( workspace_data_line >= app_init_line )); then
  printf 'workspace-data.js must load before app-init.js\n' >&2
  exit 1
fi

if (( app_init_line >= tavern_catalog_line )); then
  printf 'app-init.js must load before tavern-catalog.js\n' >&2
  exit 1
fi

if (( tavern_catalog_line >= tavern_analyze_line )); then
  printf 'tavern-catalog.js must load before tavern-analyze.js\n' >&2
  exit 1
fi

if (( tavern_analyze_line >= tavern_records_line )); then
  printf 'tavern-analyze.js must load before tavern-records.js\n' >&2
  exit 1
fi

if (( tavern_records_line >= tavern_logic_line )); then
  printf 'tavern-records.js must load before tavern-logic.js\n' >&2
  exit 1
fi

if (( tavern_logic_line >= tavern_stage_line )); then
  printf 'tavern-logic.js must load before tavern-stage.js\n' >&2
  exit 1
fi

if (( tavern_stage_line >= tavern_result_line )); then
  printf 'tavern-stage.js must load before tavern-result.js\n' >&2
  exit 1
fi

if (( tavern_result_line >= tavern_history_line )); then
  printf 'tavern-result.js must load before tavern-history.js\n' >&2
  exit 1
fi

if (( tavern_history_line >= tavern_ui_line )); then
  printf 'tavern-history.js must load before tavern-ui.js\n' >&2
  exit 1
fi

if (( tavern_ui_line >= tavern_line )); then
  printf 'tavern-ui.js must load before tavern.js\n' >&2
  exit 1
fi

if (( tavern_line >= checkin_rules_line )); then
  printf 'tavern.js must load before checkin-rules.js\n' >&2
  exit 1
fi

if (( checkin_rules_line >= checkin_status_line )); then
  printf 'checkin-rules.js must load before checkin-status.js\n' >&2
  exit 1
fi

if (( checkin_status_line >= checkin_retro_line )); then
  printf 'checkin-status.js must load before checkin-retro.js\n' >&2
  exit 1
fi

if (( checkin_retro_line >= checkin_summary_line )); then
  printf 'checkin-retro.js must load before checkin-summary.js\n' >&2
  exit 1
fi

if (( checkin_summary_line >= checkin_ui_line )); then
  printf 'checkin-summary.js must load before checkin-ui.js\n' >&2
  exit 1
fi

if (( checkin_ui_line >= checkin_line )); then
  printf 'checkin-ui.js must load before checkin.js\n' >&2
  exit 1
fi

if (( checkin_line >= workspace_entries_line )); then
  printf 'checkin.js must load before workspace-entries.js\n' >&2
  exit 1
fi

if (( workspace_entries_line >= task_hero_line )); then
  printf 'workspace-entries.js must load before task-hero.js\n' >&2
  exit 1
fi

if (( task_hero_line >= tasks_line )); then
  printf 'task-hero.js must load before tasks.js\n' >&2
  exit 1
fi

if (( tasks_line >= notes_modal_line )); then
  printf 'tasks.js must load before notes-modal.js\n' >&2
  exit 1
fi

if (( notes_modal_line >= notes_render_line )); then
  printf 'notes-modal.js must load before notes-render.js\n' >&2
  exit 1
fi

if (( notes_render_line >= notes_line )); then
  printf 'notes-render.js must load before notes.js\n' >&2
  exit 1
fi

if (( notes_line >= leave_rules_line )); then
  printf 'notes.js must load before leave-rules.js\n' >&2
  exit 1
fi

if (( leave_rules_line >= leave_ui_line )); then
  printf 'leave-rules.js must load before leave-ui.js\n' >&2
  exit 1
fi

if (( leave_ui_line >= leave_line )); then
  printf 'leave-ui.js must load before leave.js\n' >&2
  exit 1
fi

if (( leave_line >= stats_ranges_line )); then
  printf 'leave.js must load before stats-ranges.js\n' >&2
  exit 1
fi

if (( stats_ranges_line >= stats_aggregates_line )); then
  printf 'stats-ranges.js must load before stats-aggregates.js\n' >&2
  exit 1
fi

if (( stats_aggregates_line >= stats_data_line )); then
  printf 'stats-aggregates.js must load before stats-data.js\n' >&2
  exit 1
fi

if (( stats_data_line >= stats_charts_line )); then
  printf 'stats-data.js must load before stats-charts.js\n' >&2
  exit 1
fi

if (( stats_charts_line >= stats_line )); then
  printf 'stats-charts.js must load before stats.js\n' >&2
  exit 1
fi

if (( stats_line >= status_copy_line )); then
  printf 'stats.js must load before status-copy.js\n' >&2
  exit 1
fi

if (( status_copy_line >= status_confirm_line )); then
  printf 'status-copy.js must load before status-confirm.js\n' >&2
  exit 1
fi

if (( status_confirm_line >= status_toast_line )); then
  printf 'status-confirm.js must load before status-toast.js\n' >&2
  exit 1
fi

if (( status_toast_line >= status_status_line )); then
  printf 'status-toast.js must load before status-status.js\n' >&2
  exit 1
fi

if (( status_status_line >= status_ui_line )); then
  printf 'status-status.js must load before status-ui.js\n' >&2
  exit 1
fi

if (( status_ui_line >= sync_state_line )); then
  printf 'status-ui.js must load before sync-state.js\n' >&2
  exit 1
fi

if (( sync_state_line >= sync_api_line )); then
  printf 'sync-state.js must load before sync-api.js\n' >&2
  exit 1
fi

if (( sync_api_line >= sync_ui_line )); then
  printf 'sync-api.js must load before sync-ui.js\n' >&2
  exit 1
fi

if (( sync_ui_line >= sync_logic_line )); then
  printf 'sync-ui.js must load before sync-logic.js\n' >&2
  exit 1
fi

if (( sync_logic_line >= sync_line )); then
  printf 'sync-logic.js must load before sync.js\n' >&2
  exit 1
fi

if (( sync_line >= export_profiles_line )); then
  printf 'sync.js must load before export-profiles.js\n' >&2
  exit 1
fi

if (( export_profiles_line >= export_monthly_line )); then
  printf 'export-profiles.js must load before export-monthly.js\n' >&2
  exit 1
fi

if (( export_monthly_line >= export_data_line )); then
  printf 'export-monthly.js must load before export-data.js\n' >&2
  exit 1
fi

if (( export_data_line >= export_formats_line )); then
  printf 'export-data.js must load before export-formats.js\n' >&2
  exit 1
fi

if (( export_formats_line >= export_ui_line )); then
  printf 'export-formats.js must load before export-ui.js\n' >&2
  exit 1
fi

if (( export_ui_line >= export_line )); then
  printf 'export-ui.js must load before export.js\n' >&2
  exit 1
fi

required_ids=(
  "nav-checkin"
  "panel-meta-desc"
  "keyboard-shortcut-hint"
  "morning-checkin"
  "toast-container"
  "confirm-dialog-modal"
  "export-month-input"
  "export-profile-select"
  "export-trigger-btn"
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
