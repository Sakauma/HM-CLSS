from __future__ import annotations

import shutil
import os
from pathlib import Path
import sys

from selenium.webdriver.chrome.options import Options as ChromiumOptions
from selenium.webdriver.chrome.service import Service as ChromiumService
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.firefox.webdriver import WebDriver
from selenium import webdriver
from selenium.common.exceptions import WebDriverException

from browser_smoke.helpers import require

VISUAL_VIEWPORT_WIDTH = 1600
VISUAL_VIEWPORT_HEIGHT = 1114


def resolve_browser_tool(name: str) -> str | None:
    env_overrides = {
        "chrome": "HM_CLSS_CHROME_PATH",
        "chromium": "HM_CLSS_CHROME_PATH",
        "chromium-browser": "HM_CLSS_CHROME_PATH",
        "google-chrome": "HM_CLSS_CHROME_PATH",
        "chromedriver": "HM_CLSS_CHROMEDRIVER_PATH",
        "firefox": "HM_CLSS_FIREFOX_PATH",
        "geckodriver": "HM_CLSS_GECKODRIVER_PATH",
    }
    override = os.environ.get(env_overrides.get(name, ""))
    if override:
        return override

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


def create_firefox_driver(firefox_path: str, geckodriver_path: str) -> WebDriver:
    options = FirefoxOptions()
    options.enable_bidi = True
    options.add_argument("-headless")
    options.add_argument("--width=1600")
    options.add_argument("--height=1200")
    options.page_load_strategy = "eager"
    options.binary_location = firefox_path

    service = FirefoxService(executable_path=geckodriver_path)
    driver: WebDriver | None = None
    try:
        driver = webdriver.Firefox(options=options, service=service)
        driver.set_page_load_timeout(30)
        return driver
    except Exception:
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass
        raise


def create_chromium_driver(browser_path: str, chromedriver_path: str) -> WebDriver:
    options = ChromiumOptions()
    options.enable_bidi = True
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1600,1200")
    options.add_argument("--force-device-scale-factor=1")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.page_load_strategy = "eager"
    options.binary_location = browser_path

    service = ChromiumService(executable_path=chromedriver_path)
    driver: WebDriver | None = None
    try:
        driver = webdriver.Chrome(options=options, service=service)
        driver.execute_cdp_cmd(
            "Emulation.setDeviceMetricsOverride",
            {
                "width": VISUAL_VIEWPORT_WIDTH,
                "height": VISUAL_VIEWPORT_HEIGHT,
                "deviceScaleFactor": 1,
                "mobile": False,
            },
        )
        driver.set_page_load_timeout(30)
        return driver
    except Exception:
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass
        raise


def build_firefox_driver() -> WebDriver:
    firefox_path = resolve_browser_tool("firefox")
    geckodriver_path = resolve_browser_tool("geckodriver")
    require(firefox_path is not None, "firefox was not found in PATH")
    require(geckodriver_path is not None, "geckodriver was not found in PATH")

    last_error: Exception | None = None
    for attempt in range(2):
        try:
            return create_firefox_driver(firefox_path, geckodriver_path)
        except WebDriverException as error:
            last_error = error
            if attempt == 0:
                continue
            message = (
                "Firefox started but Selenium lost the browsing context during driver setup. "
                f"firefox={firefox_path}; geckodriver={geckodriver_path}; "
                "check the local Firefox/Geckodriver environment or rerun after closing stray Firefox processes."
            )
            raise RuntimeError(message) from error

    raise RuntimeError("Failed to initialize Firefox driver") from last_error


def build_chromium_driver() -> WebDriver:
    browser_path = (
        resolve_browser_tool("chromium")
        or resolve_browser_tool("chromium-browser")
        or resolve_browser_tool("google-chrome")
        or resolve_browser_tool("chrome")
    )
    chromedriver_path = resolve_browser_tool("chromedriver")
    require(browser_path is not None, "chromium/chrome was not found in PATH")
    require(chromedriver_path is not None, "chromedriver was not found in PATH")

    last_error: Exception | None = None
    for attempt in range(2):
        try:
            return create_chromium_driver(browser_path, chromedriver_path)
        except WebDriverException as error:
            last_error = error
            if attempt == 0:
                continue
            message = (
                "Chromium started but Selenium lost the browsing context during driver setup. "
                f"browser={browser_path}; chromedriver={chromedriver_path}; "
                "check the local Chromium/ChromeDriver environment or rerun after closing stray browser processes."
            )
            raise RuntimeError(message) from error

    raise RuntimeError("Failed to initialize Chromium driver") from last_error


def build_driver(browser: str = "firefox") -> WebDriver:
    browser_name = browser.lower()
    if browser_name == "firefox":
        return build_firefox_driver()
    if browser_name == "chromium":
        return build_chromium_driver()
    raise ValueError(f"Unsupported browser for smoke checks: {browser}")
