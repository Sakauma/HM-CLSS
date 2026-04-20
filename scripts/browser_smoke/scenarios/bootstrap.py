from __future__ import annotations

from selenium.webdriver.common.keys import Keys

from browser_smoke.helpers import (
    click,
    find,
    is_hidden,
    log,
    require,
    send_shortcut,
    wait_for,
    wait_text_contains,
    wait_text_not_empty,
    wait_visible,
)


def test_bootstrap(driver) -> None:
    log("1. Checking bootstrap state")
    wait_text_not_empty(driver, "current-date-time")
    wait_text_contains(driver, "keyboard-shortcut-hint", "Alt+1-8")
    nav_title = find(driver, "nav-checkin").get_attribute("title") or ""
    init_error = driver.execute_script("return window.__hmClssInitError || null;")
    require("Alt+1" in nav_title, f"nav-checkin title is missing Alt+1 hotkey; init error: {init_error}")
    require(not is_hidden(driver, "checkin-section"), "checkin-section should be the default visible section")
    log("   bootstrap ok")


def test_theme_toggle(driver) -> None:
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


def test_navigation_shortcuts(driver) -> None:
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
