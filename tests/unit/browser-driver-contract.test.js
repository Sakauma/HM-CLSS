const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { ROOT_DIR } = require('./helpers');

function readSource(relativePath) {
    return fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

test('browser smoke CLI exposes Firefox default and Chromium option', () => {
    const source = readSource('scripts/browser-smoke.py');

    assert.match(source, /--browser/);
    assert.match(source, /choices=\["firefox", "chromium"\]/);
    assert.match(source, /build_driver\(args\.browser\)/);
});

test('browser smoke shell wrapper forwards HM_CLSS_BROWSER to Selenium runner', () => {
    const source = readSource('scripts/browser-smoke.sh');

    assert.match(source, /BROWSER_NAME="\$\{HM_CLSS_BROWSER:-firefox\}"/);
    assert.match(source, /--browser "\$BROWSER_NAME"/);
    assert.match(source, /chromedriver/);
});

test('browser driver supports Firefox and Chromium toolchains', () => {
    const source = readSource('scripts/browser_smoke/driver.py');

    assert.match(source, /def build_firefox_driver/);
    assert.match(source, /def build_chromium_driver/);
    assert.match(source, /resolve_browser_tool\("chromedriver"\)/);
    assert.match(source, /HM_CLSS_CHROME_PATH/);
    assert.match(source, /HM_CLSS_CHROMEDRIVER_PATH/);
    assert.match(source, /Unsupported browser for smoke checks/);
});

test('CI runs browser smoke in Firefox and Chromium', () => {
    const source = readSource('.github/workflows/ci.yml');

    assert.match(source, /Run browser smoke/);
    assert.match(source, /browser-actions\/setup-chrome@v2/);
    assert.match(source, /Run Chromium browser smoke/);
    assert.match(source, /HM_CLSS_BROWSER:\s*chromium/);
    assert.match(source, /HM_CLSS_CHROME_PATH/);
    assert.match(source, /HM_CLSS_CHROMEDRIVER_PATH/);
});
