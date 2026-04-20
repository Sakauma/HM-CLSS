from __future__ import annotations

from browser_smoke.helpers import click, find, log, require, wait_for, wait_hidden, wait_visible


def test_sync_error_states(driver) -> None:
    log("5.1 Checking sync error states")

    driver.execute_script(
        """
        window.__syncSmokeOriginalFetch = window.fetchCloudWorkspaceData;
        window.__syncSmokeOriginalPush = window.pushCloudWorkspaceData;
        """
    )

    try:
        driver.execute_script(
            """
            window.fetchCloudWorkspaceData = async () => { throw new Error('fetch_failed_401'); };
            """
        )
        click(driver, "push-cloud-btn")
        wait_for(
            driver,
            lambda d: "上传失败，请检查配置信息。" in find(d, "toast-container").text,
            "push cloud failure toast did not appear",
        )

        driver.execute_script(
            """
            window.fetchCloudWorkspaceData = async () => { throw new Error('network down'); };
            """
        )
        click(driver, "pull-cloud-btn")
        wait_visible(driver, "confirm-dialog-modal")
        click(driver, "confirm-dialog-confirm")
        wait_hidden(driver, "confirm-dialog-modal")
        wait_for(
            driver,
            lambda d: "网络请求失败：network down" in find(d, "toast-container").text,
            "pull cloud network failure toast did not appear",
        )
    finally:
        driver.execute_script(
            """
            window.fetchCloudWorkspaceData = window.__syncSmokeOriginalFetch;
            window.pushCloudWorkspaceData = window.__syncSmokeOriginalPush;
            delete window.__syncSmokeOriginalFetch;
            delete window.__syncSmokeOriginalPush;
            """
        )

    require(find(driver, "push-cloud-btn").get_attribute("disabled") is None, "push-cloud-btn should recover after error flow")
    require(find(driver, "pull-cloud-btn").get_attribute("disabled") is None, "pull-cloud-btn should recover after error flow")
    log("   sync error states ok")
