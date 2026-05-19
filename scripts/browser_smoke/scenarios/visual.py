from __future__ import annotations

import json
import time
from pathlib import Path

from browser_smoke.artifacts import write_json_artifact
from browser_smoke.helpers import click, log, require, wait_for, wait_text_contains, wait_visible

LAYOUT_TOLERANCE = 16
VIEWPORT_TOLERANCE = 2
LAYOUT_STABLE_TOLERANCE = 1
LAYOUT_STABLE_SAMPLES = 3
LAYOUT_STABLE_INTERVAL = 0.16
LAYOUT_STABLE_TIMEOUT = 4

VISUAL_CASES = [
    {
        "name": "checkin",
        "nav": "nav-checkin",
        "section": "checkin-section",
        "title": "舰桥值班与今日状态",
        "anchor": "checkin-section",
        "elements": ["checkin-section", "shift-ops-grid", "retro-recent-log", "today-checkin-log"]
    },
    {
        "name": "tasks",
        "nav": "nav-tasks",
        "section": "tasks-section",
        "title": "全舰任务管理",
        "anchor": "tasks-section",
        "elements": ["tasks-section", "task-name", "quick-notes-container", "schedule-content"]
    },
    {
        "name": "leave",
        "nav": "nav-leave",
        "section": "leave-section",
        "title": "离舰活动审批",
        "anchor": "leave-section",
        "elements": ["leave-section", "leave-form-shell", "leave-records-table"]
    },
    {
        "name": "tavern",
        "nav": "nav-tavern",
        "section": "tavern-section",
        "title": "深空特调吧台",
        "anchor": "tavern-section",
        "elements": ["tavern-section", "view-tavern-container", "mood-text-input", "state-input"]
    },
    {
        "name": "settings",
        "nav": "nav-settings",
        "section": "settings-section",
        "title": "深空通讯设置",
        "anchor": "settings-section",
        "elements": ["settings-section", "github-token-input", "export-month-field", "export-trigger-btn"]
    }
]


def collect_layout_snapshot(driver, element_ids):
    return driver.execute_script(
        """
        const ids = arguments[0];
        const root = document.scrollingElement || document.documentElement;
        const snapshot = {
          viewport: {
            width: Math.round(window.innerWidth),
            height: Math.round(window.innerHeight)
          },
          scrollTop: Math.round(root.scrollTop || 0),
          ambient: document.documentElement.dataset.ambient || '',
          elements: {}
        };

        ids.forEach((id) => {
          const el = document.getElementById(id);
          if (!el) {
            snapshot.elements[id] = null;
            return;
          }

          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          snapshot.elements[id] = {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            visible: !(el.classList.contains('hidden') || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0),
            childCount: el.children.length
          };
        });

        return snapshot;
        """,
        element_ids,
    )


def layout_signature(snapshot):
    signature = [snapshot["scrollTop"]]
    for element_id in sorted(snapshot["elements"].keys()):
        metrics = snapshot["elements"][element_id]
        if metrics is None:
            signature.append(None)
            continue
        signature.append(
            (
                metrics["x"],
                metrics["y"],
                metrics["width"],
                metrics["height"],
                metrics["visible"],
                metrics["childCount"],
            )
        )
    return signature


def signatures_match(actual, previous) -> bool:
    if previous is None or len(actual) != len(previous):
        return False

    for actual_value, previous_value in zip(actual, previous):
        if actual_value is None or previous_value is None:
            if actual_value != previous_value:
                return False
            continue

        if isinstance(actual_value, tuple):
            for actual_part, previous_part in zip(actual_value, previous_value):
                if isinstance(actual_part, (int, float)) and isinstance(previous_part, (int, float)):
                    if abs(actual_part - previous_part) > LAYOUT_STABLE_TOLERANCE:
                        return False
                elif actual_part != previous_part:
                    return False
        elif abs(actual_value - previous_value) > LAYOUT_STABLE_TOLERANCE:
            return False

    return True


def wait_layout_stable(driver, element_ids):
    deadline = time.monotonic() + LAYOUT_STABLE_TIMEOUT
    previous_signature = None
    stable_samples = 0
    last_snapshot = None

    while time.monotonic() < deadline:
        last_snapshot = collect_layout_snapshot(driver, element_ids)
        current_signature = layout_signature(last_snapshot)

        if signatures_match(current_signature, previous_signature):
            stable_samples += 1
            if stable_samples >= LAYOUT_STABLE_SAMPLES:
                return last_snapshot
        else:
            stable_samples = 0
            previous_signature = current_signature

        time.sleep(LAYOUT_STABLE_INTERVAL)

    require(False, "Visual layout did not settle before snapshot capture")
    return last_snapshot


def compare_layout_snapshots(case, actual, expected) -> None:
    case_name = case["name"]
    require(expected is not None, f"Missing visual baseline for {case_name}")
    for key in ("width", "height"):
        delta = abs(actual["viewport"][key] - expected["viewport"][key])
        require(
            delta <= VIEWPORT_TOLERANCE,
            f"{case_name} viewport {key} drifted by {delta}px (expected {expected['viewport'][key]}, got {actual['viewport'][key]})",
        )

    for element_id, expected_metrics in expected["elements"].items():
        actual_metrics = actual["elements"].get(element_id)
        require(actual_metrics is not None, f"{case_name} missing metrics for {element_id}")
        require(actual_metrics["visible"] == expected_metrics["visible"], f"{case_name} visibility mismatch for {element_id}")
        require(actual_metrics["childCount"] == expected_metrics["childCount"], f"{case_name} child count mismatch for {element_id}")

        for key in ("x", "width", "height"):
            delta = abs(actual_metrics[key] - expected_metrics[key])
            require(
                delta <= LAYOUT_TOLERANCE,
                f"{case_name} {element_id} {key} drifted by {delta}px (expected {expected_metrics[key]}, got {actual_metrics[key]})",
            )

        actual_document_y = actual_metrics["y"] + actual["scrollTop"]
        expected_document_y = expected_metrics["y"] + expected["scrollTop"]
        document_y_delta = abs(actual_document_y - expected_document_y)
        require(
            document_y_delta <= LAYOUT_TOLERANCE,
            f"{case_name} {element_id} document y drifted by {document_y_delta}px (expected {expected_document_y}, got {actual_document_y})",
        )


def capture_visual_case(driver, case, artifact_dir: Path | None):
    click(driver, case["nav"])
    wait_visible(driver, case["section"])
    wait_text_contains(driver, "panel-meta-title", case["title"])
    driver.execute_script(
        "document.getElementById(arguments[0]).scrollIntoView({ block: 'start', behavior: 'instant' });",
        case["anchor"],
    )
    wait_for(
        driver,
        lambda d: d.execute_script(
            """
            const el = document.getElementById(arguments[0]);
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.top <= (window.innerHeight * 0.7);
            """,
            case["anchor"],
        ),
        f"{case['name']} anchor did not settle into view",
    )

    if artifact_dir is not None:
        visual_dir = artifact_dir / "visual"
        visual_dir.mkdir(parents=True, exist_ok=True)
        driver.save_screenshot(str(visual_dir / f"{case['name']}.png"))

    return wait_layout_stable(driver, case["elements"])


def test_visual_layout_baselines(driver, baseline_path: str, artifact_dir: Path | None) -> None:
    log("11. Checking visual layout baselines")

    baselines = json.loads(Path(baseline_path).read_text(encoding="utf-8"))
    current_snapshots = {}

    for case in VISUAL_CASES:
        current_snapshots[case["name"]] = capture_visual_case(driver, case, artifact_dir)

    write_json_artifact(artifact_dir, "visual/layout-current.json", current_snapshots)

    for case in VISUAL_CASES:
        compare_layout_snapshots(case, current_snapshots[case["name"]], baselines.get(case["name"]))

    log("   visual layout baselines ok")
