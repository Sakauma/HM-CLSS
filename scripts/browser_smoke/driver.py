from __future__ import annotations

import shutil
import os
from pathlib import Path
import sys

from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.webdriver import WebDriver
from selenium import webdriver

from browser_smoke.helpers import require


def resolve_browser_tool(name: str) -> str | None:
    path = shutil.which(name)
    if path is not None:
        return path

    executable_names = [name]
    if os.name == "nt" and not name.endswith(".exe"):
        executable_names.insert(0, f"{name}.exe")

    roots = [
        os.environ.get("CONDA_PREFIX"),
        os.environ.get("HM_CLSS_BROWSER_ENV"),
        sys.prefix,
    ]
    subdirs = ["", "bin", "Scripts", os.path.join("Library", "bin")]

    for root in roots:
        if not root:
            continue
        for subdir in subdirs:
            base = Path(root) / subdir if subdir else Path(root)
            for executable_name in executable_names:
                candidate = base / executable_name
                if candidate.exists():
                    return str(candidate)

    return None


def build_driver() -> WebDriver:
    options = Options()
    options.add_argument("-headless")
    options.page_load_strategy = "eager"

    firefox_path = resolve_browser_tool("firefox")
    geckodriver_path = resolve_browser_tool("geckodriver")
    require(firefox_path is not None, "firefox was not found in PATH")
    require(geckodriver_path is not None, "geckodriver was not found in PATH")

    options.binary_location = firefox_path
    service = Service(executable_path=geckodriver_path)
    driver = webdriver.Firefox(options=options, service=service)
    driver.set_window_size(1600, 1200)
    driver.set_page_load_timeout(30)
    return driver
