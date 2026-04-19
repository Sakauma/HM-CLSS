#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import sys
import time
from datetime import date, timedelta

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait

TIMEOUT = 20


def log(message: str) -> None:
    print(message, flush=True)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def wait_for(driver: webdriver.Firefox, predicate, message: str, timeout: int = TIMEOUT):
    try:
        return WebDriverWait(driver, timeout).until(predicate)
    except TimeoutException as exc:
        raise AssertionError(message) from exc


def wait_ready(driver: webdriver.Firefox) -> None:
    wait_for(
        driver,
        lambda d: d.execute_script("return document.readyState") in ("interactive", "complete"),
        "Page did not reach an interactive DOM state",
    )


def find(driver: webdriver.Firefox, element_id: str):
    return driver.find_element(By.ID, element_id)


def text_of(driver: webdriver.Firefox, element_id: str) -> str:
    return find(driver, element_id).text.strip()


def is_hidden(driver: webdriver.Firefox, element_id: str) -> bool:
    return bool(
        driver.execute_script(
            "const el = document.getElementById(arguments[0]); return !el || el.classList.contains('hidden');",
            element_id,
        )
    )


def wait_visible(driver: webdriver.Firefox, element_id: str, timeout: int = TIMEOUT):
    wait_for(
        driver,
        lambda d: not is_hidden(d, element_id),
        f"{element_id} did not become visible",
        timeout=timeout,
    )


def wait_hidden(driver: webdriver.Firefox, element_id: str, timeout: int = TIMEOUT):
    wait_for(
        driver,
        lambda d: is_hidden(d, element_id),
        f"{element_id} did not become hidden",
        timeout=timeout,
    )


def wait_text_contains(driver: webdriver.Firefox, element_id: str, expected: str, timeout: int = TIMEOUT):
    wait_for(
        driver,
        lambda d: expected in text_of(d, element_id),
        f"{element_id} did not contain expected text: {expected}",
        timeout=timeout,
    )


def wait_text_not_empty(driver: webdriver.Firefox, element_id: str, timeout: int = TIMEOUT):
    wait_for(
        driver,
        lambda d: text_of(d, element_id) != "",
        f"{element_id} stayed empty",
        timeout=timeout,
    )


def send_shortcut(driver: webdriver.Firefox, *keys: str) -> None:
    body = driver.find_element(By.TAG_NAME, "body")
    actions = ActionChains(driver)
    actions.move_to_element(body).click()

    modifiers = keys[:-1]
    final_key = keys[-1]

    for key in modifiers:
        actions.key_down(key)
    actions.send_keys(final_key)
    for key in reversed(modifiers):
        actions.key_up(key)

    actions.perform()


def set_field_value(driver: webdriver.Firefox, element_id: str, value: str) -> None:
    driver.execute_script(
        """
        const el = document.getElementById(arguments[0]);
        el.value = arguments[1];
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        """,
        element_id,
        value,
    )


def click(driver: webdriver.Firefox, element_id: str) -> None:
    find(driver, element_id).click()


def test_bootstrap(driver: webdriver.Firefox) -> None:
    log("1. Checking bootstrap state")
    wait_text_not_empty(driver, "current-date-time")
    wait_text_contains(driver, "keyboard-shortcut-hint", "Alt+1-8")
    nav_title = find(driver, "nav-checkin").get_attribute("title") or ""
    require("Alt+1" in nav_title, "nav-checkin title is missing Alt+1 hotkey")
    require(not is_hidden(driver, "checkin-section"), "checkin-section should be the default visible section")
    log("   bootstrap ok")


def test_theme_toggle(driver: webdriver.Firefox) -> None:
    log("2. Checking theme toggle")
    before = bool(driver.execute_script("return document.documentElement.classList.contains('dark');"))
    click(driver, "theme-toggle")
    wait_for(
        driver,
        lambda d: bool(d.execute_script("return document.documentElement.classList.contains('dark');")) != before,
        "Theme did not toggle",
    )
    stored = driver.execute_script("return localStorage.theme || '';")
    after = bool(driver.execute_script("return document.documentElement.classList.contains('dark');"))
    require(stored == ("dark" if after else "light"), "Theme toggle did not persist localStorage.theme")
    log("   theme toggle ok")


def test_navigation_shortcuts(driver: webdriver.Firefox) -> None:
    log("3. Checking navigation shortcuts")
    send_shortcut(driver, Keys.ALT, "2")
    wait_visible(driver, "phone-section")
    wait_text_contains(driver, "panel-meta-title", "认知干扰拦截")

    send_shortcut(driver, Keys.ALT, "5")
    wait_visible(driver, "leave-section")
    wait_text_contains(driver, "panel-meta-title", "离舰活动审批")

    send_shortcut(driver, Keys.ALT, "]")
    wait_visible(driver, "tavern-section")
    wait_text_contains(driver, "panel-meta-title", "深空特调吧台")

    send_shortcut(driver, Keys.ALT, "[")
    wait_visible(driver, "leave-section")
    wait_text_contains(driver, "panel-meta-title", "离舰活动审批")
    log("   navigation shortcuts ok")


def test_quick_capture_flow(driver: webdriver.Firefox) -> None:
    log("4. Checking quick capture flow")
    send_shortcut(driver, Keys.ALT, "3")
    wait_visible(driver, "tasks-section")

    send_shortcut(driver, Keys.CONTROL, "k")
    wait_visible(driver, "quick-capture-modal")

    token = f"browser-smoke-{int(time.time())}"
    set_field_value(driver, "quick-capture-input", token)
    wait_for(
        driver,
        lambda d: not find(d, "quick-capture-save").get_attribute("disabled"),
        "quick-capture-save never became enabled",
    )
    click(driver, "quick-capture-save")
    wait_hidden(driver, "quick-capture-modal")
    wait_text_contains(driver, "quick-notes-container", token)

    send_shortcut(driver, Keys.ALT, "4")
    wait_visible(driver, "archive-section")
    set_field_value(driver, "archive-search-input", token)
    wait_for(
        driver,
        lambda d: token in find(d, "archive-list-container").text,
        "Archive did not render the saved quick capture entry",
    )
    log("   quick capture ok")


def test_leave_workflows(driver: webdriver.Firefox) -> None:
    log("5. Checking leave workflow split")
    send_shortcut(driver, Keys.ALT, "5")
    wait_visible(driver, "leave-section")
    wait_text_contains(driver, "leave-form-title", "今日离舰")
    require(find(driver, "leave-date").get_attribute("disabled") is not None, "leave-date should be locked in today workflow")

    click(driver, "leave-workflow-planned")
    wait_text_contains(driver, "leave-form-title", "预请假")
    require(find(driver, "leave-date").get_attribute("disabled") is None, "leave-date should be editable in planned workflow")
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    set_field_value(driver, "leave-date", tomorrow)
    wait_text_contains(driver, "leave-form-alert", "生效日：")

    click(driver, "leave-workflow-retro")
    wait_text_contains(driver, "leave-form-title", "补请假")
    require(not is_hidden(driver, "leave-correction-group"), "Retro leave correction note field should be visible")
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    set_field_value(driver, "leave-date", yesterday)
    wait_text_contains(driver, "leave-form-alert", "历史统计")
    log("   leave workflows ok")


def test_retro_checkin_flow(driver: webdriver.Firefox) -> None:
    log("6. Checking retro checkin workflow")
    send_shortcut(driver, Keys.ALT, "1")
    wait_visible(driver, "checkin-section")

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    set_field_value(driver, "retro-checkin-date", yesterday)
    set_field_value(driver, "retro-checkin-period", "morning")
    set_field_value(driver, "retro-checkin-start", "08:00")
    set_field_value(driver, "retro-checkin-end", "12:00")
    set_field_value(driver, "retro-checkin-reason", "browser smoke retro checkin")

    wait_for(
        driver,
        lambda d: find(d, "retro-checkin-submit").get_attribute("disabled") is None,
        "retro-checkin-submit did not become enabled",
    )
    wait_for(
        driver,
        lambda d: text_of(d, "retro-preview-chip") != "等待预判",
        "retro preview chip never updated",
    )
    click(driver, "retro-checkin-submit")
    wait_text_contains(driver, "retro-week-usage", "1/")
    wait_for(
        driver,
        lambda d: "browser smoke retro checkin" in find(d, "retro-recent-log").text,
        "retro recent log did not include the submitted reason",
    )
    log("   retro checkin ok")


def test_tavern_flow(driver: webdriver.Firefox) -> None:
    log("7. Checking tavern analysis flow")
    send_shortcut(driver, Keys.ALT, "6")
    wait_visible(driver, "tavern-section")
    require(find(driver, "btn-start-analyze").get_attribute("disabled") is not None, "Analyze button should start disabled")

    set_field_value(driver, "mood-text-input", "今天很累，但事情终于开始回到轨道上了。")
    wait_for(
        driver,
        lambda d: find(d, "btn-start-analyze").get_attribute("disabled") is None,
        "Analyze button did not become enabled after mood input",
    )
    click(driver, "btn-start-analyze")
    wait_for(
        driver,
        lambda d: d.execute_script(
            "const el = document.getElementById('state-result'); return el.classList.contains('opacity-100') && el.getAttribute('aria-hidden') === 'false';"
        ),
        "Tavern result state did not become active",
        timeout=10,
    )
    wait_text_not_empty(driver, "res-title", timeout=10)
    click(driver, "btn-save-drink")
    click(driver, "btn-result-history")
    wait_for(
        driver,
        lambda d: text_of(d, "history-count") == "1",
        "Saved drink did not appear in history count",
    )
    log("   tavern flow ok")


def build_driver() -> webdriver.Firefox:
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
        driver.refresh()
        wait_ready(driver)

        test_bootstrap(driver)
        test_theme_toggle(driver)
        test_navigation_shortcuts(driver)
        test_quick_capture_flow(driver)
        test_leave_workflows(driver)
        test_retro_checkin_flow(driver)
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
