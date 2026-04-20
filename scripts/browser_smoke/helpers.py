from __future__ import annotations

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.firefox.webdriver import WebDriver
from selenium.webdriver.support.ui import WebDriverWait

TIMEOUT = 20


def log(message: str) -> None:
    print(message, flush=True)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def wait_for(driver: WebDriver, predicate, message: str, timeout: int = TIMEOUT):
    try:
        return WebDriverWait(driver, timeout).until(predicate)
    except TimeoutException as exc:
        raise AssertionError(message) from exc


def wait_ready(driver: WebDriver) -> None:
    wait_for(
        driver,
        lambda d: d.execute_script("return document.readyState") in ("interactive", "complete"),
        "Page did not reach an interactive DOM state",
    )


def find(driver: WebDriver, element_id: str):
    return driver.find_element(By.ID, element_id)


def text_of(driver: WebDriver, element_id: str) -> str:
    return find(driver, element_id).text.strip()


def is_hidden(driver: WebDriver, element_id: str) -> bool:
    return bool(
        driver.execute_script(
            "const el = document.getElementById(arguments[0]); return !el || el.classList.contains('hidden');",
            element_id,
        )
    )


def wait_visible(driver: WebDriver, element_id: str, timeout: int = TIMEOUT):
    wait_for(
        driver,
        lambda d: not is_hidden(d, element_id),
        f"{element_id} did not become visible",
        timeout=timeout,
    )


def wait_hidden(driver: WebDriver, element_id: str, timeout: int = TIMEOUT):
    wait_for(
        driver,
        lambda d: is_hidden(d, element_id),
        f"{element_id} did not become hidden",
        timeout=timeout,
    )


def wait_text_contains(driver: WebDriver, element_id: str, expected: str, timeout: int = TIMEOUT):
    wait_for(
        driver,
        lambda d: expected in text_of(d, element_id),
        f"{element_id} did not contain expected text: {expected}",
        timeout=timeout,
    )


def wait_text_not_empty(driver: WebDriver, element_id: str, timeout: int = TIMEOUT):
    wait_for(
        driver,
        lambda d: text_of(d, element_id) != "",
        f"{element_id} stayed empty",
        timeout=timeout,
    )


def wait_active_element_id(driver: WebDriver, element_id: str, timeout: int = TIMEOUT):
    wait_for(
        driver,
        lambda d: d.switch_to.active_element.get_attribute("id") == element_id,
        f"{element_id} did not receive focus",
        timeout=timeout,
    )


def send_shortcut(driver: WebDriver, *keys: str) -> None:
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


def send_tab(driver: WebDriver, shift: bool = False) -> None:
    actions = ActionChains(driver)
    if shift:
        actions.key_down(Keys.SHIFT)
    actions.send_keys(Keys.TAB)
    if shift:
        actions.key_up(Keys.SHIFT)
    actions.perform()


def set_field_value(driver: WebDriver, element_id: str, value: str) -> None:
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


def click(driver: WebDriver, element_id: str) -> None:
    find(driver, element_id).click()


def install_debug_hooks(driver: WebDriver) -> None:
    driver.execute_script(
        """
        if (window.__hmClssSmokeHooksInstalled) return;
        window.__hmClssSmokeHooksInstalled = true;
        window.__hmClssConsoleEvents = [];
        window.__hmClssPageErrors = [];

        const safeStringify = (value) => {
          try {
            if (typeof value === 'string') return value;
            return JSON.stringify(value);
          } catch (_error) {
            return String(value);
          }
        };

        ['log', 'info', 'warn', 'error'].forEach((level) => {
          const original = console[level].bind(console);
          console[level] = (...args) => {
            window.__hmClssConsoleEvents.push({
              level,
              message: args.map(safeStringify).join(' '),
              at: new Date().toISOString()
            });
            return original(...args);
          };
        });

        window.addEventListener('error', (event) => {
          window.__hmClssPageErrors.push({
            type: 'error',
            message: event.message || '',
            source: event.filename || '',
            line: event.lineno || 0,
            column: event.colno || 0,
            at: new Date().toISOString()
          });
        });

        window.addEventListener('unhandledrejection', (event) => {
          window.__hmClssPageErrors.push({
            type: 'unhandledrejection',
            message: safeStringify(event.reason),
            at: new Date().toISOString()
          });
        });
        """
    )
