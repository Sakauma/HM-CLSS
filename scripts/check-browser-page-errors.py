#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from browser_smoke.page_errors import unexpected_page_errors


def main() -> int:
    normal_events = [{"type": "log", "message": "expected diagnostic"}]
    if unexpected_page_errors(normal_events):
        raise AssertionError("normal non-error events should not fail the audit")

    uncaught_error = {"type": "error", "message": "injected uncaught error"}
    if not unexpected_page_errors([uncaught_error]):
        raise AssertionError("injected uncaught errors must fail the audit")

    expected_error = {"type": "error", "message": "expected failure"}
    if unexpected_page_errors([expected_error], [expected_error]):
        raise AssertionError("exactly acknowledged expected errors should pass")
    if not unexpected_page_errors(
        [expected_error, {"type": "error", "message": "different failure"}],
        [expected_error],
    ):
        raise AssertionError("unexpected errors must remain visible beside expected ones")
    if not unexpected_page_errors(
        [expected_error, expected_error],
        [expected_error],
    ):
        raise AssertionError("expected error allowances must be consumed one event at a time")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
