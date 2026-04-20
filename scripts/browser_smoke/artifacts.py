from __future__ import annotations

import json
import re
from pathlib import Path


def ensure_artifact_dir(path: str | None) -> Path | None:
    if not path:
        return None

    artifact_dir = Path(path)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    return artifact_dir


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def write_text_artifact(artifact_dir: Path | None, name: str, content: str) -> None:
    if artifact_dir is None:
        return

    (artifact_dir / name).write_text(content, encoding="utf-8")


def write_json_artifact(artifact_dir: Path | None, name: str, payload) -> None:
    if artifact_dir is None:
        return

    (artifact_dir / name).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def capture_failure_artifacts(driver, artifact_dir: Path | None, scenario_name: str, error: Exception) -> None:
    if artifact_dir is None:
        return

    slug = slugify(scenario_name)
    screenshot_path = artifact_dir / f"{slug}.png"
    driver.save_screenshot(str(screenshot_path))
    write_text_artifact(artifact_dir, f"{slug}.html", driver.page_source)
    write_text_artifact(artifact_dir, f"{slug}.txt", str(error))

    console_events = driver.execute_script("return window.__hmClssConsoleEvents || [];")
    page_errors = driver.execute_script("return window.__hmClssPageErrors || [];")
    write_json_artifact(artifact_dir, f"{slug}-console.json", console_events)
    write_json_artifact(artifact_dir, f"{slug}-page-errors.json", page_errors)
