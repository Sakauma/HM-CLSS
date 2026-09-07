from __future__ import annotations

from collections.abc import Iterable, Mapping


def unexpected_page_errors(
    errors: Iterable[Mapping[str, object]] | None,
    expected_events: Iterable[Mapping[str, object]] = (),
) -> list[Mapping[str, object]]:
    """Return uncaught page errors that are not explicitly expected.

    Expected events are matched by both event type and message.  This keeps an
    intentional failure scenario from masking a different error emitted at the
    same time.
    """

    expected_counts: dict[tuple[object, object], int] = {}
    for event in expected_events:
        key = (event.get("type", ""), event.get("message", ""))
        expected_counts[key] = expected_counts.get(key, 0) + 1

    unexpected: list[Mapping[str, object]] = []
    for error in errors or ():
        if error.get("type") not in {"error", "unhandledrejection"}:
            continue
        event = (error.get("type", ""), error.get("message", ""))
        if expected_counts.get(event, 0):
            expected_counts[event] -= 1
        else:
            unexpected.append(error)
    return unexpected
