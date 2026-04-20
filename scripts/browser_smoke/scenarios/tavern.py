from __future__ import annotations

from selenium.webdriver.common.keys import Keys

from browser_smoke.helpers import click, find, log, require, send_shortcut, set_field_value, wait_for, wait_text_not_empty, wait_visible


def test_tavern_flow(driver) -> None:
    log("11. Checking tavern analysis flow")
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
        lambda d: find(d, "history-count").text.strip() == "1",
        "Saved drink did not appear in history count",
    )
    log("   tavern flow ok")
