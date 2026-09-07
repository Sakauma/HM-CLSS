#!/usr/bin/env python3
"""Exercise preload page-error capture against real browser documents."""

from __future__ import annotations

import argparse
import functools
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from browser_smoke.driver import build_driver
from browser_smoke.helpers import install_debug_hooks, wait_ready
from browser_smoke.page_errors import unexpected_page_errors


FIXTURE = """<!doctype html>
<meta charset="utf-8">
<title>HM-CLSS page error fixture</title>
<script>
  const mode = new URLSearchParams(location.search).get('case');
  if (mode === 'initial-throw') {
    throw new Error('fixture initial script error');
  }
  if (mode === 'initial-rejection') {
    Promise.reject(new Error('fixture initial rejection'));
  }
  if (mode === 'console-log') {
    console.log('fixture ordinary diagnostic');
  }
  if (mode === 'expected-business-error') {
    throw new Error('fixture expected business error');
  }
  if (mode === 'refresh-error') {
    const key = 'hm-clss-page-error-fixture-refresh-count';
    const count = Number(sessionStorage.getItem(key) || '0');
    sessionStorage.setItem(key, String(count + 1));
    throw new Error(count === 0 ? 'fixture refresh before error' : 'fixture refresh after error');
  }
</script>
"""


def _wait_for_async_events() -> None:
    time.sleep(0.2)


def _errors(driver):
    _wait_for_async_events()
    return driver.execute_script("return window.__hmClssPageErrors || [];")


def _require_error(driver, message: str) -> None:
    errors = _errors(driver)
    if not unexpected_page_errors(errors):
        raise AssertionError(f"{message}: preload capture saw no unexpected error: {errors!r}")


def _require_no_error(driver, message: str, expected=()) -> None:
    errors = _errors(driver)
    unexpected = unexpected_page_errors(errors, expected)
    if unexpected:
        raise AssertionError(f"{message}: unexpected page errors: {unexpected!r}")


def run_page_error_browser_checks(driver) -> None:
    with TemporaryDirectory(prefix="hm-clss-page-errors-") as temp_dir:
        fixture_path = Path(temp_dir) / "fixture.html"
        fixture_path.write_text(FIXTURE, encoding="utf-8")
        handler = functools.partial(SimpleHTTPRequestHandler, directory=temp_dir)
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()

        try:
            base_url = f"http://127.0.0.1:{server.server_port}/fixture.html"

            driver.get(f"{base_url}?case=initial-throw")
            wait_ready(driver)
            _require_error(driver, "initial script throw")

            driver.get(f"{base_url}?case=initial-rejection")
            wait_ready(driver)
            _require_error(driver, "initial unhandled rejection")

            driver.get(f"{base_url}?case=console-log")
            wait_ready(driver)
            _require_no_error(driver, "ordinary console log")

            driver.get(f"{base_url}?case=expected-business-error")
            wait_ready(driver)
            _require_no_error(
                driver,
                "explicitly expected business error",
                [{"type": "error", "message": "Error: fixture expected business error"}],
            )

            driver.get(f"{base_url}?case=refresh-error")
            wait_ready(driver)
            _require_error(driver, "error before refresh")
            driver.refresh()
            wait_ready(driver)
            _require_error(driver, "error after refresh")
        finally:
            server.shutdown()
            server.server_close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify preload page-error capture in a real browser.")
    parser.add_argument("--browser", default="firefox", choices=["firefox", "chromium"])
    args = parser.parse_args()

    driver = build_driver(args.browser)
    try:
        install_debug_hooks(driver)
        run_page_error_browser_checks(driver)
    finally:
        driver.quit()

    print("Real browser page-error negative checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
