from __future__ import annotations

import shutil

from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.webdriver import WebDriver
from selenium import webdriver

from browser_smoke.helpers import require


def build_driver() -> WebDriver:
    options = Options()
    options.add_argument("-headless")
    options.page_load_strategy = "eager"

    firefox_path = shutil.which("firefox")
    geckodriver_path = shutil.which("geckodriver")
    require(firefox_path is not None, "firefox was not found in PATH")
    require(geckodriver_path is not None, "geckodriver was not found in PATH")

    options.binary_location = firefox_path
    service = Service(executable_path=geckodriver_path)
    driver = webdriver.Firefox(options=options, service=service)
    driver.set_window_size(1600, 1200)
    driver.set_page_load_timeout(30)
    return driver
