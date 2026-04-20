#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
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
    init_error = driver.execute_script("return window.__hmClssInitError || null;")
    require("Alt+1" in nav_title, f"nav-checkin title is missing Alt+1 hotkey; init error: {init_error}")
    require(not is_hidden(driver, "checkin-section"), "checkin-section should be the default visible section")
    log("   bootstrap ok")


def test_theme_toggle(driver: webdriver.Firefox) -> None:
    log("2. Checking theme toggle")
    before = bool(driver.execute_script("return document.documentElement.classList.contains('dark');"))
    before_pressed = find(driver, "theme-toggle").get_attribute("aria-pressed")
    click(driver, "theme-toggle")
    wait_for(
        driver,
        lambda d: bool(d.execute_script("return document.documentElement.classList.contains('dark');")) != before,
        "Theme did not toggle",
    )
    stored = driver.execute_script("return localStorage.theme || '';")
    after = bool(driver.execute_script("return document.documentElement.classList.contains('dark');"))
    after_pressed = find(driver, "theme-toggle").get_attribute("aria-pressed")
    require(stored == ("dark" if after else "light"), "Theme toggle did not persist localStorage.theme")
    require(before_pressed != after_pressed, "Theme toggle did not update aria-pressed")
    log("   theme toggle ok")


def test_navigation_shortcuts(driver: webdriver.Firefox) -> None:
    log("3. Checking navigation shortcuts")
    send_shortcut(driver, Keys.ALT, "2")
    wait_visible(driver, "phone-section")
    wait_text_contains(driver, "panel-meta-title", "认知干扰拦截")

    send_shortcut(driver, Keys.ALT, "5")
    wait_visible(driver, "leave-section")
    wait_text_contains(driver, "panel-meta-title", "离舰活动审批")
    require(find(driver, "nav-leave").get_attribute("aria-expanded") == "true", "nav-leave should be expanded")
    require(find(driver, "leave-section").get_attribute("aria-hidden") == "false", "leave-section should be announced as visible")

    send_shortcut(driver, Keys.ALT, "]")
    wait_visible(driver, "tavern-section")
    wait_text_contains(driver, "panel-meta-title", "深空特调吧台")

    send_shortcut(driver, Keys.ALT, "[")
    wait_visible(driver, "leave-section")
    wait_text_contains(driver, "panel-meta-title", "离舰活动审批")
    log("   navigation shortcuts ok")


def test_statistics_panel(driver: webdriver.Firefox) -> None:
    log("4. Checking statistics panel")
    send_shortcut(driver, Keys.ALT, "7")
    wait_visible(driver, "stats-section")
    wait_text_contains(driver, "panel-meta-title", "维生统计分析")

    wait_for(
        driver,
        lambda d: d.execute_script(
            "return !!window.checkinRateChart && !!window.checkinPeriodChart && !!window.taskDurationChart && !!window.phoneResistChart && !!window.taskTagChart;"
        ),
        "Statistics charts did not initialize",
    )

    period_buttons = driver.find_elements(By.CSS_SELECTOR, ".stats-period-btn")
    period_buttons[1].click()
    wait_for(
        driver,
        lambda d: d.execute_script(
            "return document.querySelector('.stats-period-btn.bg-white, .stats-period-btn.bg-slate-700')?.getAttribute('data-period')"
        ) == "month",
        "Month statistics period did not activate",
    )
    wait_for(
        driver,
        lambda d: d.execute_script(
            "return Array.isArray(window.checkinRateChart?.data?.labels) && window.checkinRateChart.data.labels.length === 10"
        ),
        "Month statistics labels did not update",
    )

    period_buttons[2].click()
    wait_for(
        driver,
        lambda d: d.execute_script(
            "return document.querySelector('.stats-period-btn.bg-white, .stats-period-btn.bg-slate-700')?.getAttribute('data-period')"
        ) == "year",
        "Year statistics period did not activate",
    )
    wait_for(
        driver,
        lambda d: d.execute_script(
            "return Array.isArray(window.checkinRateChart?.data?.labels) && window.checkinRateChart.data.labels.length === 12"
        ),
        "Year statistics labels did not update",
    )
    log("   statistics panel ok")


def test_settings_and_exports(driver: webdriver.Firefox) -> None:
    log("5. Checking sync settings and exports")
    send_shortcut(driver, Keys.ALT, "8")
    wait_visible(driver, "settings-section")
    wait_text_contains(driver, "panel-meta-title", "深空通讯设置")

    token = "ghp_browser_smoke_token"
    gist_id = "browser-smoke-gist-id"
    set_field_value(driver, "github-token-input", token)
    set_field_value(driver, "gist-id-input", gist_id)
    click(driver, "save-config-btn")
    wait_for(
        driver,
        lambda d: d.execute_script("return localStorage.getItem('githubToken');") == token,
        "githubToken was not saved to localStorage",
    )
    wait_for(
        driver,
        lambda d: d.execute_script("return localStorage.getItem('gistId');") == gist_id,
        "gistId was not saved to localStorage",
    )
    wait_for(
        driver,
        lambda d: "配置已保存到本地" in find(d, "toast-container").text,
        "save-config toast did not appear",
    )
    wait_for(
        driver,
        lambda d: any(
            element.get_attribute("role") == "status"
            for element in d.find_elements(By.CSS_SELECTOR, "#toast-container > *")
        ),
        "toast container did not expose a status live region",
    )

    driver.execute_script("document.getElementById('export-trigger-btn').scrollIntoView({ block: 'center' });")
    set_field_value(driver, "export-month-input", date.today().strftime("%Y-%m"))
    driver.execute_script(
        """
        window.__downloads = [];
        window.triggerFileDownload = (filename, content, mimeType) => {
          window.__downloads.push({ filename, content, mimeType });
        };
        """
    )

    export_cases = [
        ("month_json", ".json"),
        ("month_markdown", ".md"),
        ("month_csv", ".csv"),
        ("workspace_json", ".json"),
    ]

    for index, (profile_id, extension) in enumerate(export_cases, start=1):
        set_field_value(driver, "export-profile-select", profile_id)
        click(driver, "export-trigger-btn")
        wait_for(
            driver,
            lambda d, expected=index: len(d.execute_script("return window.__downloads || [];")) == expected,
            f"{profile_id} export did not trigger",
        )
        disabled = find(driver, "export-month-input").get_attribute("disabled") is not None
        if profile_id == "workspace_json":
            require(disabled, "Month input should be disabled for workspace_json")
        else:
            require(not disabled, f"Month input should stay enabled for {profile_id}")

        download = driver.execute_script("return window.__downloads[arguments[0]];", index - 1)
        require(download["filename"].endswith(extension), f"{profile_id} filename mismatch")

        if profile_id == "month_json":
            payload = json.loads(download["content"])
            require(payload["meta"]["scope"] == "month", "month_json payload scope mismatch")
        elif profile_id == "workspace_json":
            payload = json.loads(download["content"])
            require(payload["meta"]["scope"] == "workspace", "workspace_json payload scope mismatch")
            require("githubToken" not in download["content"], "workspace export leaked githubToken")
            require("gistId" not in download["content"], "workspace export leaked gistId")
        elif profile_id == "month_markdown":
            require(download["content"].startswith("# HM-CLSS 月度复盘｜"), "month_markdown payload mismatch")
        elif profile_id == "month_csv":
            header = download["content"].splitlines()[0]
            require(
                header == "category,date,display_date,time_start,time_end,label,status,metric,source,notes",
                "month_csv header mismatch",
            )
    log("   sync settings and exports ok")


def test_quick_capture_flow(driver: webdriver.Firefox) -> None:
    log("6. Checking quick capture flow")
    send_shortcut(driver, Keys.ALT, "3")
    wait_visible(driver, "tasks-section")

    send_shortcut(driver, Keys.CONTROL, "k")
    wait_visible(driver, "quick-capture-modal")
    require(find(driver, "quick-capture-modal").get_attribute("aria-hidden") == "false", "quick-capture-modal should expose aria-hidden=false")
    wait_for(
        driver,
        lambda d: d.switch_to.active_element.get_attribute("id") == "quick-capture-input",
        "quick-capture-input did not receive focus on open",
    )

    driver.execute_script("document.getElementById('quick-capture-tag').focus();")
    driver.switch_to.active_element.send_keys(Keys.TAB)
    wait_for(
        driver,
        lambda d: d.switch_to.active_element.get_attribute("id") == "quick-capture-close",
        "Quick capture tab loop did not wrap to the first control",
    )

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
    log("7. Checking leave workflow split")
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
    log("8. Checking retro checkin workflow")
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

    set_field_value(driver, "retro-checkin-start", "08:10")
    set_field_value(driver, "retro-checkin-end", "12:10")
    set_field_value(driver, "retro-checkin-reason", "browser smoke retro override")
    click(driver, "retro-checkin-submit")
    wait_visible(driver, "confirm-dialog-modal")
    wait_text_contains(driver, "confirm-dialog-title", "覆盖这条班次记录")
    click(driver, "confirm-dialog-cancel")
    wait_hidden(driver, "confirm-dialog-modal")

    click(driver, "retro-checkin-submit")
    wait_visible(driver, "confirm-dialog-modal")
    click(driver, "confirm-dialog-confirm")
    wait_hidden(driver, "confirm-dialog-modal")
    wait_for(
        driver,
        lambda d: "browser smoke retro override" in find(d, "retro-recent-log").text,
        "retro override reason did not update after confirmation",
    )
    log("   retro checkin ok")


def test_tavern_flow(driver: webdriver.Firefox) -> None:
    log("9. Checking tavern analysis flow")
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
