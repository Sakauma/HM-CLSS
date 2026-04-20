#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys

from selenium.common.exceptions import TimeoutException

from browser_smoke.driver import build_driver
from browser_smoke.helpers import log, wait_ready
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
from browser_smoke.scenarios.tavern import test_tavern_flow
from browser_smoke.scenarios.workspace import (
    test_leave_workflows,
    test_quick_capture_flow,
    test_retro_checkin_flow,
    test_task_hero_flow,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run HM-CLSS browser smoke checks with Firefox + Selenium.")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="Target URL to test.")
    args = parser.parse_args()

    driver = build_driver()
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

        test_bootstrap(driver)
        test_theme_toggle(driver)
        test_navigation_shortcuts(driver)
        test_statistics_panel(driver)
        test_settings_and_exports(driver)
        test_quick_capture_flow(driver)
        test_task_hero_flow(driver)
        test_leave_workflows(driver)
        test_retro_checkin_flow(driver)
        test_accessibility_regressions(driver)
        test_tavern_flow(driver)
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
