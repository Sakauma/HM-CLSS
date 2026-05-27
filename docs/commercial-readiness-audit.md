# HM-CLSS 商业级工程成熟度审计

审计日期：2026-05-27

## 目标口径

“商业级工程”在本项目里不等于引入构建链或后端服务，而是在当前零构建静态应用约束下，让代码、数据、测试、发布和维护边界足够可信、可回归、可解释、可交接。

## 当前基线

- 架构：仍保持 `index.html` + `assets/js/` + `assets/css/` + 本地 vendor 的零构建形态。
- 模块边界：运行时、工作区、外层 UI、业务 features 已按职责拆分。
- 数据安全：localStorage schema、迁移、安全解析、同步前本地备份、失败回滚和 token session scope 已有单测覆盖。
- 交付门禁：`scripts/smoke-check.sh` 覆盖语法、模块依赖、静态模板契约、运行时状态契约、发布治理契约、单测、Python 编译、脚本顺序、关键资源、文档和 vendor checksum。
- 浏览器验证：`scripts/browser-smoke.sh` 覆盖启动、主题、导航、统计、同步导出、速记、任务、离舰、补打卡、可访问性、视觉基线和酒馆流程。
- CI：GitHub Actions 在 push / pull_request 上运行 smoke check，并在浏览器环境可用时运行浏览器 smoke。

## 本轮补强

- 新增运行时状态契约检查：功能模块不得绕过 `runtimeActions` 直接写共享状态，也不得回流使用旧的全局写入 helper。
- 收紧检查器能力：覆盖嵌套属性写入、复合赋值、数组原地 mutation、delete、递增递减，以及模板字符串表达式里的状态写入。
- 统一状态写入入口：酒馆、成就、离舰模块的旧 helper 写法已迁移到 `runtimeActions.*`。
- 扩大静态模板契约：更多 metric 卡片改用零构建模板声明，并由测试证明声明的 ID 会被真实渲染出来。
- 文档同步：README、CONTEXT 和 smoke manifest 已记录新增契约与测试入口。
- 补齐发布治理：新增 `CHANGELOG.md`、`docs/release-checklist.md`，并明确发版验证、回滚和数据安全检查。
- 补齐安全治理：新增 `SECURITY.md`，明确 token scope、敏感数据、漏洞报告和 vendor 更新流程。
- 补齐贡献治理：新增 `CONTRIBUTING.md`，明确开发、提交、测试和 PR 要求。
- 补齐维护治理：新增 `docs/troubleshooting.md`、`docs/browser-support.md`、`docs/data-compatibility.md`。
- 新增发布治理检查：`scripts/check-release-governance.js` 验证治理文档、README 引用和 required-docs 清单。
- 新增验收留痕：`docs/release-validation.md` 记录最近一轮 smoke、浏览器 smoke 和功能自测映射。
- 新增 vendor 清单检查：`scripts/check-vendor-manifest.js` 验证第三方脚本的 README、source URL、版本文件名和 checksum 清单一致。
- 新增 vendor 复核节奏：`docs/vendor-review.md` 明确发布前、季度和安全公告触发的联网复核流程。
- 完成首轮 vendor 联网复核：升级 Chart.js 4.5.1 和 DOMPurify 3.4.7，记录 Tailwind browser build、Lucide、marked 的跨主版本暂缓原因，并刷新 checksum。
- 收紧双浏览器视觉验证：Chromium 通过 Chrome DevTools viewport override 固定到 Firefox 基线视口，并为 settings 页保留浏览器专属视觉快照，避免扩大全局容差。
- 修复 CI 失败产物留痕：浏览器 smoke artifact 目录统一解析到仓库根，GitHub Actions 允许上传 `.artifacts` 隐藏目录，失败时可下载截图、HTML、console 和当前布局快照。
- 准备 `v1.0.0` 正式发布记录：`CHANGELOG.md` 已从纯 `Unreleased` 模板扩展为带日期的商业级基线 release note。

## 已验证证据

- `bash scripts/smoke-check.sh`
  - 结果：通过。
  - 覆盖：84 个 Node 单测、模块依赖、静态模板契约、运行时状态契约、发布治理契约、vendor 清单契约、vendor checksum、脚本顺序、资源和文档存在性。
- `bash scripts/browser-smoke.sh`
  - 结果：通过。
  - 覆盖：真实 Firefox + Selenium 的关键用户路径、可访问性回归和视觉布局基线。
- GitHub Actions `ci` run #36（2026-05-27）
  - 结果：通过。
  - 覆盖：合并后的 `main` 提交 `e3d7435`，远程 `smoke-check`、Firefox browser smoke、Chrome for Testing 安装、Chromium browser smoke，以及 Chart.js / DOMPurify vendor 刷新后的运行路径。
- Git tag `v1.0.0`
  - 结果：已推送。
  - 覆盖：tag 指向合并后的商业级基线提交 `e3d7435`。
- GitHub Pages build and deployment run `26522538984`
  - 结果：通过。
  - 覆盖：合并后的 `main` 提交已完成 Pages 构建和部署。

## 仍需推进的商业级缺口

- 发布落地：`v1.0.0` release note、合并后的 `main`、远程 tag、主线 CI 和 Pages 部署证据已齐备。
- 本地 Chromium 证据：CI 已验证 Chromium 自动化；本地可选入口仍为 `HM_CLSS_BROWSER=chromium`。本机缺少 Chrome/ChromeDriver，因此本地 Chromium 不是本轮 release blocker。
- 产品探索验收：本轮没有大面积产品交互改版；`docs/release-validation.md` 已记录自动化覆盖映射。未来大面积视觉或交互改版前仍需追加人工探索式验收。
- 长期依赖安全监控：已完成本轮联网复核；后续仍需按 `docs/vendor-review.md` 在 release、季度或安全公告触发时复核。

## 下一批优先级

1. 为 Tailwind browser build、Lucide 和 marked 的跨主版本升级开独立兼容性验证任务。
2. 大面积视觉或交互改版前，补一次人工探索验收记录，并把结论追加到 `docs/release-validation.md`。
3. 下一次 release 前按 `docs/vendor-review.md` 再做一轮 vendor 复核。
