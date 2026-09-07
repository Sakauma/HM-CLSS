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
            "return document.querySelector('.stats-period-btn-active')?.getAttribute('data-period')"
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
            "return document.querySelector('.stats-period-btn-active')?.getAttribute('data-period')"
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

    # Exercise the application's real stored Markdown path. The published
    # DOMPurify advisories target optional hooks/configuration or DOM-return
    # modes that HM-CLSS does not use; this protects its reachable default
    # string-sanitization path against representative executable payloads.
    driver.execute_script(
        """
        window.__hmClssSanitizerSnapshot = {
          storageValue: localStorage.getItem('quickNotesData'),
          runtimeValue: JSON.parse(JSON.stringify(runtimeSelectors.quickNotesData()))
        };
        """
    )
    try:
        sanitizer_version = driver.execute_script(
            """
            window.__hmClssSanitizerExecuted = 0;
            const today = getTodayString();
            const noteText = [
              '# Browser smoke safe heading',
              '',
              'Safe **strong text** stays rendered.',
              '<script>window.__hmClssSanitizerExecuted += 1</script>',
              '<img src="x-browser-smoke" onerror="window.__hmClssSanitizerExecuted += 1">',
              '<svg><g onload="window.__hmClssSanitizerExecuted += 1"></g></svg>',
              '[unsafe link](javascript:window.__hmClssSanitizerExecuted%20%2B%3D%201)'
            ].join('\\n');
            const storedNotes = JSON.parse(localStorage.getItem('quickNotesData') || '{}');
            storedNotes[today] = [{ time: '12:34', text: noteText, tag: 'idea' }];
            localStorage.setItem('quickNotesData', JSON.stringify(storedNotes));
            runtimeActions.setQuickNotesData(JSON.parse(localStorage.getItem('quickNotesData')));
            updateQuickNotesList();
            return DOMPurify.version;
            """
        )
        require(sanitizer_version == "3.4.15", f"Unexpected DOMPurify version: {sanitizer_version}")
        wait_for(
            driver,
            lambda d: d.execute_script(
                "return document.querySelector('#quick-notes-container h1')?.textContent.trim();"
            ) == "Browser smoke safe heading",
            "Stored Markdown heading did not render",
        )
        sanitizer_result = driver.execute_async_script(
            """
            const done = arguments[arguments.length - 1];
            setTimeout(() => {
              const container = document.getElementById('quick-notes-container');
              const inlineHandlers = Array.from(container.querySelectorAll('*')).flatMap((element) =>
                Array.from(element.attributes).filter((attribute) => attribute.name.toLowerCase().startsWith('on'))
              );
              const javascriptLinks = Array.from(container.querySelectorAll('a[href]')).filter((link) =>
                /^\\s*javascript:/i.test(link.getAttribute('href') || '')
              );
              done({
                scriptCount: container.querySelectorAll('script').length,
                inlineHandlerCount: inlineHandlers.length,
                javascriptLinkCount: javascriptLinks.length,
                executionMarker: window.__hmClssSanitizerExecuted,
                strongText: container.querySelector('strong')?.textContent.trim() || ''
              });
            }, 100);
            """
        )
        require(sanitizer_result["scriptCount"] == 0, "Stored Markdown retained a script node")
        require(sanitizer_result["inlineHandlerCount"] == 0, "Stored Markdown retained an inline event handler")
        require(sanitizer_result["javascriptLinkCount"] == 0, "Stored Markdown retained a javascript: link")
        require(sanitizer_result["executionMarker"] == 0, "Stored Markdown executed an injected payload")
        require(sanitizer_result["strongText"] == "strong text", "Safe Markdown strong text did not render")
    finally:
        driver.execute_script(
            """
            const snapshot = window.__hmClssSanitizerSnapshot;
            if (snapshot.storageValue === null) {
              localStorage.removeItem('quickNotesData');
            } else {
              localStorage.setItem('quickNotesData', snapshot.storageValue);
            }
            runtimeActions.setQuickNotesData(snapshot.runtimeValue);
            updateQuickNotesList();
            delete window.__hmClssSanitizerSnapshot;
            delete window.__hmClssSanitizerExecuted;
            """
        )

    token = "ghp_browser_smoke_token"
    gist_id = "browser-smoke-gist-id"
    set_field_value(driver, "github-token-input", token)
    set_field_value(driver, "gist-id-input", gist_id)
    click(driver, "save-config-btn")
    wait_for(
        driver,
        lambda d: d.execute_script("return sessionStorage.getItem('githubToken');") == token,
        "githubToken was not saved to sessionStorage",
    )
    wait_for(
        driver,
        lambda d: d.execute_script("return localStorage.getItem('gistId');") == gist_id,
        "gistId was not saved to localStorage",
    )
    wait_for(
        driver,
        lambda d: d.execute_script("return localStorage.getItem('githubToken');") is None,
        "githubToken should not persist in localStorage",
    )
    wait_for(
        driver,
        lambda d: "Token 仅保存在当前会话" in find(d, "toast-container").text,
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
