from __future__ import annotations

import json
from datetime import date

from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By

from browser_smoke.helpers import (
    click,
    find,
    log,
    require,
    send_shortcut,
    set_field_value,
    wait_for,
    wait_text_contains,
    wait_visible,
)


def test_statistics_panel(driver) -> None:
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


def test_settings_and_exports(driver) -> None:
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
