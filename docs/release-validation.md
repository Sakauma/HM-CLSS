# Release Validation Log

最新验证日期：2026-05-27

## Scope

本次验证覆盖当前工作树中的商业级工程化补强：

- 运行时状态写入契约。
- 静态模板契约扩展。
- 发布、安全、贡献、排障、浏览器支持和数据兼容治理文档。
- README、CONTEXT 和 smoke manifest 同步。

## Automated Evidence

### `bash scripts/smoke-check.sh`

结果：通过。

覆盖证据：

- Module dependency check passed.
- Static template contract check passed.
- Runtime state contract check passed.
- Release governance check passed.
- Vendor manifest check passed.
- Node test runner: 84 tests passed.
- Vendor checksum, script order, required files, required docs, and required IDs passed.

远程证据：GitHub Actions `ci` run #31（2026-05-27）中 `smoke-check` job 通过。

### `bash scripts/browser-smoke.sh`

结果：通过。

覆盖证据：

- Bootstrap state.
- Theme toggle.
- Navigation shortcuts.
- Statistics panel.
- Sync settings, export paths, and sync error states.
- Quick capture flow.
- Task hero flow.
- Leave workflow split.
- Retro check-in workflow.
- Accessibility regressions.
- Visual layout baselines.
- Tavern analysis flow.

远程证据：GitHub Actions `ci` run #31（2026-05-27）中 `browser-smoke` job 通过，包含 Firefox smoke、Chrome for Testing 安装，以及 `HM_CLSS_BROWSER=chromium` 的 Chromium smoke。Chromium 使用浏览器专属视觉基线覆盖 settings 页的字体/表单渲染差异，未放宽全局视觉容差。

## Functional Self-Check Mapping

`docs/functional-self-check.md` 中的主要高风险区域已经由 browser smoke 覆盖到自动化证据：

- 启动、主题、导航和快捷键。
- 值班、补打卡、离舰、任务和捕捉池。
- 调酒吧台、统计、同步、导出、可访问性和视觉布局。

发布前如存在大面积视觉或交互改版，仍应追加人工探索式验收，并把发现记录到本文件。

## Residual Release Notes

- Firefox 是本地和 CI 的基础浏览器 gate。
- Chromium 已由 CI gate 验证：GitHub Actions 通过 `browser-actions/setup-chrome@v2` 安装 Chrome for Testing 和 ChromeDriver 后运行同一套 smoke 场景。本机当前没有 Chrome/ChromeDriver，因此本轮本地只验证 Firefox 路径。
- 本次没有修改存储 schema 版本。
- 本次没有修改 vendor 文件。
