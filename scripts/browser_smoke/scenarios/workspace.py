from __future__ import annotations

from datetime import date, timedelta

from selenium.webdriver.common.keys import Keys

from browser_smoke.helpers import (
    click,
    find,
    is_hidden,
    log,
    require,
    send_shortcut,
    set_field_value,
    text_of,
    wait_active_element_id,
    wait_for,
    wait_hidden,
    wait_text_contains,
    wait_visible,
)


def test_quick_capture_flow(driver) -> None:
    log("6. Checking quick capture flow")
    send_shortcut(driver, Keys.ALT, "3")
    wait_visible(driver, "tasks-section")

    send_shortcut(driver, Keys.CONTROL, "k")
    wait_visible(driver, "quick-capture-modal")
    require(find(driver, "quick-capture-modal").get_attribute("aria-hidden") == "false", "quick-capture-modal should expose aria-hidden=false")
    wait_active_element_id(driver, "quick-capture-input")

    driver.execute_script("document.getElementById('quick-capture-tag').focus();")
    driver.switch_to.active_element.send_keys(Keys.TAB)
    wait_for(
        driver,
        lambda d: d.switch_to.active_element.get_attribute("id") == "quick-capture-close",
        "Quick capture tab loop did not wrap to the first control",
    )

    token = "browser-smoke-capture"
    set_field_value(driver, "quick-capture-input", token)
    wait_for(
        driver,
        lambda d: not find(d, "quick-capture-save").get_attribute("disabled"),
        "quick-capture-save never became enabled",
    )
    click(driver, "quick-capture-save")
    wait_hidden(driver, "quick-capture-modal")
    wait_text_contains(driver, "quick-notes-container", token)

    click(driver, "nav-archive")
    wait_visible(driver, "archive-section")
    set_field_value(driver, "archive-search-input", token)
    wait_for(
        driver,
        lambda d: token in find(d, "archive-list-container").text,
        "Archive did not render the saved quick capture entry",
    )
    log("   quick capture ok")


def test_task_hero_flow(driver) -> None:
    log("7. Checking task hero flow")
    send_shortcut(driver, Keys.ALT, "3")
    wait_visible(driver, "tasks-section")

    token = "browser-smoke-task"
    set_field_value(driver, "task-name", token)
    click(driver, "start-task")

    wait_for(
        driver,
        lambda d: not is_hidden(d, "current-task-container"),
        "current-task-container did not become visible",
    )
    wait_text_contains(driver, "current-task-name", token)
    wait_text_contains(driver, "hero-active-task-display", token)

    click(driver, "end-task")
    wait_for(
        driver,
        lambda d: is_hidden(d, "current-task-container"),
        "current-task-container did not hide after ending the task",
    )
    wait_text_contains(driver, "today-tasks-table", token)
    log("   task hero ok")


def test_leave_workflows(driver) -> None:
    log("8. Checking leave workflow split")
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


def test_retro_checkin_flow(driver) -> None:
    log("9. Checking retro checkin workflow")
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
