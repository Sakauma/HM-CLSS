#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys

from selenium.common.exceptions import TimeoutException

from browser_smoke.artifacts import capture_failure_artifacts, ensure_artifact_dir
from browser_smoke.driver import build_driver
from browser_smoke.helpers import install_debug_hooks, log, wait_ready
from browser_smoke.scenarios.accessibility import test_accessibility_regressions
from browser_smoke.scenarios.bootstrap import (
    test_bootstrap,
    test_navigation_shortcuts,
    test_theme_toggle,
)
from browser_smoke.scenarios.insights import (
    test_settings_and_exports,
    test_statistics_panel,
)
from browser_smoke.scenarios.sync import test_sync_error_states
from browser_smoke.scenarios.tavern import test_tavern_flow
from browser_smoke.scenarios.visual import test_visual_layout_baselines
from browser_smoke.scenarios.workspace import (
    test_leave_workflows,
    test_quick_capture_flow,
    test_retro_checkin_flow,
    test_task_hero_flow,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run HM-CLSS browser smoke checks with Firefox + Selenium.")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="Target URL to test.")
    parser.add_argument("--artifact-dir", default="", help="Directory used to store browser smoke artifacts.")
    parser.add_argument("--visual-baseline", default="tests/fixtures/visual-layout-baselines.json", help="Path to the visual layout baseline fixture.")
    args = parser.parse_args()

    driver = build_driver()
    artifact_dir = ensure_artifact_dir(args.artifact_dir)
    try:
        try:
            driver.get(args.url)
        except TimeoutException:
            log("Navigation hit the page-load timeout; continuing with DOM checks.")
        wait_ready(driver)
        driver.execute_script("window.localStorage.clear(); window.sessionStorage.clear();")
        try:
            driver.refresh()
        except TimeoutException:
            log("Refresh hit the page-load timeout; continuing with DOM checks.")
        wait_ready(driver)
        install_debug_hooks(driver)

        scenarios = [
            ("bootstrap", lambda: test_bootstrap(driver)),
            ("theme-toggle", lambda: test_theme_toggle(driver)),
            ("navigation-shortcuts", lambda: test_navigation_shortcuts(driver)),
            ("statistics-panel", lambda: test_statistics_panel(driver)),
            ("settings-and-exports", lambda: test_settings_and_exports(driver)),
            ("sync-error-states", lambda: test_sync_error_states(driver)),
            ("quick-capture-flow", lambda: test_quick_capture_flow(driver)),
            ("task-hero-flow", lambda: test_task_hero_flow(driver)),
            ("leave-workflows", lambda: test_leave_workflows(driver)),
            ("retro-checkin-flow", lambda: test_retro_checkin_flow(driver)),
            ("accessibility-regressions", lambda: test_accessibility_regressions(driver)),
            ("visual-layout-baselines", lambda: test_visual_layout_baselines(driver, args.visual_baseline, artifact_dir)),
            ("tavern-flow", lambda: test_tavern_flow(driver)),
        ]

        for scenario_name, scenario in scenarios:
            try:
                scenario()
            except Exception as error:
                capture_failure_artifacts(driver, artifact_dir, scenario_name, error)
                raise

        log("Browser smoke passed.")
        return 0
    finally:
        driver.quit()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as error:
        print(f"Browser smoke failed: {error}", file=sys.stderr, flush=True)
        raise SystemExit(1)
