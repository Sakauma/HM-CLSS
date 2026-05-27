const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { ROOT_DIR } = require('./helpers');

function readScript(relativePath) {
    return fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

test('Windows smoke-check wrapper resolves repo Python and Node before invoking Bash smoke', () => {
    const source = readScript('scripts/smoke-check.ps1');

    assert.match(source, /Git\\bin\\bash\.exe/);
    assert.match(source, /\.conda\\browser-test\\python\.exe/);
    assert.match(source, /PYTHON_BIN/);
    assert.match(source, /NODE_BIN/);
    assert.match(source, /scripts\/smoke-check\.sh/);
});

test('Windows browser-smoke wrapper points Selenium runs at the repo browser environment', () => {
    const source = readScript('scripts/browser-smoke.ps1');

    assert.match(source, /\.conda\\browser-test/);
    assert.match(source, /HM_CLSS_BROWSER_ENV/);
    assert.match(source, /HM_CLSS_BROWSER/);
    assert.match(source, /HM_CLSS_CHROME_PATH/);
    assert.match(source, /HM_CLSS_CHROMEDRIVER_PATH/);
    assert.match(source, /HM_CLSS_BROWSER_ARTIFACT_DIR/);
    assert.match(source, /scripts\/browser-smoke\.sh/);
});
