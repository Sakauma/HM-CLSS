from __future__ import annotations

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

from browser_smoke.helpers import (
    click,
    find,
    log,
    require,
    send_shortcut,
    send_tab,
    set_field_value,
    wait_active_element_id,
    wait_for,
    wait_hidden,
    wait_visible,
)


def test_accessibility_regressions(driver) -> None:
    log("10. Checking accessibility regressions")

    send_shortcut(driver, Keys.CONTROL, "k")
    wait_visible(driver, "quick-capture-modal")
    wait_active_element_id(driver, "quick-capture-input")
    set_field_value(driver, "quick-capture-input", "a11y smoke")
    wait_for(
        driver,
        lambda d: not find(d, "quick-capture-save").get_attribute("disabled"),
        "quick-capture-save did not become enabled for accessibility checks",
    )
    last_focusable_id = driver.execute_script(
        """
        const focusables = Array.from(
          document.querySelectorAll(
            '#quick-capture-modal button:not([disabled]), #quick-capture-modal textarea:not([disabled]), #quick-capture-modal select:not([disabled]), #quick-capture-modal input:not([disabled]), #quick-capture-modal [href], #quick-capture-modal [tabindex]:not([tabindex="-1"])'
          )
        ).filter((element) => !element.closest('.hidden'));
        return focusables.at(-1)?.id || null;
        """
    )
    require(last_focusable_id, "quick capture modal did not expose a last focusable control")

    driver.execute_script("document.getElementById('quick-capture-close').focus();")
    send_tab(driver, shift=True)
    wait_active_element_id(driver, last_focusable_id)

    send_tab(driver)
    wait_active_element_id(driver, "quick-capture-close")
    driver.switch_to.active_element.send_keys(Keys.ESCAPE)
    wait_hidden(driver, "quick-capture-modal")

    driver.execute_script("document.getElementById('retro-checkin-submit').focus();")
    click(driver, "retro-checkin-submit")
    wait_visible(driver, "confirm-dialog-modal")
    wait_active_element_id(driver, "confirm-dialog-confirm")
    require(find(driver, "confirm-dialog-modal").get_attribute("aria-hidden") == "false", "confirm dialog should expose aria-hidden=false")
    require(find(driver, "confirm-dialog-modal").get_attribute("aria-modal") == "true", "confirm dialog should expose aria-modal=true")
    click(driver, "confirm-dialog-cancel")
    wait_hidden(driver, "confirm-dialog-modal")
    wait_active_element_id(driver, "retro-checkin-submit")

    driver.execute_script("showToast('a11y smoke toast', 'success');")
    wait_for(
        driver,
        lambda d: any(
            element.get_attribute("aria-live") in ("polite", "assertive")
            for element in d.find_elements(By.CSS_SELECTOR, "#toast-container > *")
        ),
        "toast items did not expose aria-live",
    )
    log("   accessibility regressions ok")
