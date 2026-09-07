# HM-CLSS
风格化的自我管理打卡系统

> “你现在的首要任务，就是活下去，然后拯救地球。”

**HM-CLSS (Hail Mary Crew Life Support System)** 是一套以《挽救计划》为灵感的前端维生系统。它负责记录你的唤醒状态、科研供能、干扰阻断、离舰报备，以及跨设备的数据漂流。

本项目当前采用 **纯前端、零构建** 架构：

- 页面外壳：`index.html`
- 样式渲染：本地 `assets/vendor/` Tailwind 浏览器脚本 + 自定义 CSS
- 字体加载：`index.html` 默认从 Google Fonts 加载 IBM Plex 与 Noto Sans SC；网络不可用时由 Tailwind 字体栈回退到系统中文字体和 `sans-serif` / `monospace`
- 行为逻辑：Vanilla JavaScript
- 数据存储：浏览器 `localStorage`
- 云端同步：GitHub Gist API

本地第三方脚本的来源与版本记录在 `assets/vendor/README.md`，完整性由 `scripts/smoke_manifest/vendor-checksums.txt` 和 smoke check 校验。


## 🚀 核心维生模块

- **航星维生日志（考勤系统）**：划分为早、中、晚三个象限，记录连线与登出状态，并判定是否合规。
- **多巴胺戒断阻断（专注力记录）**：记录对抗碎片化信息干扰的次数，并联动成就图鉴。
- **核心科研阵列（任务管理）**：提供任务计时、任务归档与 18 小时制“事件视界”时间轴映射。
- **噬星体捕捉池（速记系统）**：通过全局快捷键 `Ctrl+K` 快速记录灵感、日志、异常与待办。
- **休眠与离舰报备（请假系统）**：支持全天离舰与分时段离舰。
- **深空酒馆（情绪特调）**：根据输入文本生成情绪配方，并保存到酒柜历史。
- **全舰效能雷达（数据分析）**：多维图表展示考勤、任务与干扰拦截数据。
- **深空通讯链路（云端同步）**：通过 GitHub Gist 在不同设备间同步本地数据。

统计口径：标记为 `excused` 的签到或登出记录仍保留在统计分母中，并与合规记录一样计入合规率。


## 🧭 启动方式

本系统没有构建步骤，也不依赖后端服务。你可以直接用以下方式启动：

### 本地静态服务

```bash
python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000
```

### 快速预览

直接在浏览器中打开 `index.html` 即可进行简单冒烟测试。

### 自动化回归

JavaScript 语法文件和页面脚本加载顺序分别以 [`js-syntax.txt`](./scripts/smoke_manifest/js-syntax.txt) 与 [`script-order.txt`](./scripts/smoke_manifest/script-order.txt) 为唯一清单来源。不要在 README 复制逐文件命令或加载顺序；直接运行完整回归入口：

```bash
bash scripts/smoke-check.sh
```

该入口会执行语法、模块依赖、模板与运行时契约、单元测试、浏览器脚本编译、脚本顺序、资源存在性和 vendor 完整性检查。

Windows 上建议使用 PowerShell 包装脚本，它会优先使用项目内的 `.conda/browser-test/python.exe`，并把 Node/Python 路径转换给 Git Bash：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-check.ps1
```

等价入口：

- Git Bash / CI：`bash scripts/smoke-check.sh`
- Windows PowerShell：`powershell -ExecutionPolicy Bypass -File scripts/smoke-check.ps1`
- GitHub Actions：`smoke-check` job 先运行同一套 `bash scripts/smoke-check.sh`

### 本地数据导出

导出入口位于 **云端同步中心** 页面下半段的 **本地数据导出** 卡片。

先在导出卡里选择格式，再决定是否按月份打包。

- `全量工作区 JSON`
  生成完整本地快照，适合离线备份或手动迁移。
- `本月结构化 JSON`
  生成单月结构化数据，适合后续二次分析。
- `本月复盘 Markdown`
  生成可直接贴进复盘文档的月度摘要。
- `本月明细 CSV`
  生成适合表格软件继续筛选的流水明细。

说明：

- 导出内容不包含 `GitHub Token` 和 `Gist ID`
- 月度导出会附带摘要统计，口径与页面中的值班、任务、速记、离舰和酒单数据保持一致
- 切到 `全量工作区 JSON` 时，月份输入会自动停用

### 真实浏览器冒烟

首次使用前，先创建项目内的 `conda` 浏览器测试环境：

```bash
bash scripts/setup-browser-test.sh
```

默认会把环境建到 `./.conda/browser-test`，并从 [environment.browser-test.yml](./environment.browser-test.yml) 安装浏览器测试依赖。

环境就绪后，再执行：

```bash
bash scripts/browser-smoke.sh
```

Windows 上可以直接调用包装脚本：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/browser-smoke.ps1
```

浏览器冒烟会默认访问 `http://127.0.0.1:8000`。如果目标地址不可达，脚本会自动启动本地静态服务。失败截图、页面源码、控制台日志和视觉快照统一输出到 `.artifacts/browser-smoke/`；该目录只用于本地排障和 CI 工件，不进入版本库。

默认浏览器 gate 是 Firefox。若本机或测试环境同时提供 Chromium/Chrome 与 `chromedriver`，可以复用同一套场景跑 Chromium：

```bash
HM_CLSS_BROWSER=chromium bash scripts/browser-smoke.sh
```

Windows 包装脚本也支持显式浏览器参数：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/browser-smoke.ps1 -Browser chromium
```

### 持续集成

仓库内置了 [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)：

- `push` / `pull_request` 自动运行 `bash scripts/smoke-check.sh`
- 浏览器环境可用时继续运行 `bash scripts/browser-smoke.sh`
- CI 通过 `browser-actions/setup-chrome@v2` 额外运行 Chromium smoke，并把 Chrome / ChromeDriver 路径显式传给 Selenium。
- 本地脚本和 CI 使用同一套 `conda` 浏览器环境定义，不走两套口径
- 浏览器冒烟失败时会把截图、页面源码和控制台留痕上传为 CI 工件

可选环境变量：

- `HM_CLSS_BROWSER_ENV`
  覆盖默认的 `conda` 环境路径。
- `HM_CLSS_BROWSER_ENV_FILE`
  覆盖默认的浏览器测试环境文件路径。
- `HM_CLSS_CONDA_SOLVER`
  覆盖默认求解器；脚本默认使用 `classic` 以兼容缺少 `libmamba` 的 `conda` 安装。
- `HM_CLSS_SMOKE_URL`
  指向自定义预览地址；未提供时默认使用 `http://127.0.0.1:8000`。
- `HM_CLSS_BROWSER_ARTIFACT_DIR`
  覆盖默认的浏览器冒烟工件目录；默认输出到 `.artifacts/browser-smoke`。
  目录内部会再细分成 `failures/` 和 `visual/` 两层。
- `HM_CLSS_BROWSER`
  选择浏览器驱动，默认 `firefox`；可选 `chromium`，要求环境中存在 Chromium/Chrome 与 `chromedriver`。
- `HM_CLSS_CHROME_PATH`
  Chromium 模式下显式指定 Chrome / Chromium 可执行文件路径，CI 会由 `browser-actions/setup-chrome` 注入。
- `HM_CLSS_CHROMEDRIVER_PATH`
  Chromium 模式下显式指定 `chromedriver` 路径，CI 会由 `browser-actions/setup-chrome` 注入。

### 商业级治理文档

发布、贡献、安全和兼容性约束由下列文档共同维护，并由 `scripts/check-release-governance.js` 接入 `smoke-check`：

- [SECURITY.md](./SECURITY.md)：安全边界、敏感数据规则、漏洞报告和 vendor 升级流程。
- [CONTRIBUTING.md](./CONTRIBUTING.md)：开发流程、提交风格、测试要求和 PR 检查项。
- [CHANGELOG.md](./CHANGELOG.md)：未发布变更、发版模板和验证记录。
- [docs/release-checklist.md](./docs/release-checklist.md)：发版前自动门禁、人工验收、数据安全和回滚步骤。
- [docs/release-validation.md](./docs/release-validation.md)：最近一轮 smoke 与浏览器验收的证据留痕。
- [docs/troubleshooting.md](./docs/troubleshooting.md)：浏览器 smoke、数据损坏、同步、导出、布局和 vendor 排障。
- [docs/browser-support.md](./docs/browser-support.md)：浏览器支持矩阵、发布验证期望和自动化缺口。
- [docs/data-compatibility.md](./docs/data-compatibility.md)：本地存储 schema、迁移、同步兼容和恢复原则。
- [docs/vendor-review.md](./docs/vendor-review.md)：第三方浏览器脚本的版本、安全和升级复核节奏。

## 🗂️ 舰体结构

当前仓库的主结构如下：

- `index.html`
  飞船主舱。负责页面骨架、字体链接、样式链接，以及脚本加载块；Tailwind 令牌配置位于 `assets/js/runtime/tailwind-config.js`。
- `assets/css/theme.css`
  主题令牌、页面背景、滚动条与基础焦点反馈。
- `assets/css/shell.css`
  舰桥主任务卡和摘要卡这类共享壳层样式。
- `assets/css/shell-navigation.css`
  左侧导航、当前舱段高亮和环境横幅。
- `assets/css/shell-panels.css`
  设置页与系统面板卡、下拉和流程切换样式。
- `assets/css/components.css`
  状态徽章、主按钮、流程切换和通用操作卡片。
- `assets/css/features.css`
  深空酒馆结果卡与历史酒柜等结果态外观。
- `assets/css/features-notes.css`
  速记弹窗、归档列表和快速捕捉相关外观。
- `assets/css/features-tavern.css`
  深空酒馆舞台、酒杯、液面、波浪和情绪光效。
- `assets/css/motion.css`
  弹窗、toast、酒馆液面和减弱动效规则。
- `assets/js/runtime/theme.js`
  主题切换与深浅色图标同步。
- `assets/js/runtime/tailwind-config.js`
  Tailwind 浏览器运行时的主题色、阴影和字体令牌；必须在本地 Tailwind vendor 脚本之后加载。
- `assets/js/runtime/store.js`
  运行时可变状态容器，以及对旧全局变量的统一代理入口。
- `assets/js/runtime/state.js`
  全局共享状态、配置常量、标签映射与情绪/成就静态清单。
- `assets/js/runtime/storage-migrations.js`
  按 schema 版本登记迁移函数，避免把历史兼容逻辑继续堆进 `storage.js`。
- `assets/js/runtime/storage-payload.js`
  本地 JSON 安全读取、schema 版本识别与启动载荷组装。
- `assets/js/runtime/storage-shapes.js`
  值班日记录、离舰记录与环境偏好的结构归一化。
- `assets/js/runtime/storage.js`
  本地存储初始化、schema 迁移、结构归一化、持久化与当前任务恢复。
- `assets/js/runtime/date-utils.js`
  日期键、展示日期与当前时间的统一工具。
- `assets/js/runtime/dom-utils.js`
  轻量 DOM helper、图标标签封装与旧记录字段兼容。
- `assets/js/runtime/ambient.js`
  值班留痕判断、补录配额和全局航行情绪派生。
- `assets/js/runtime/module-registry.js`
  启动模块注册中心，负责统一收集和执行各功能模块的 `init` 入口。
- `assets/js/workspace/metrics.js`
  成就、统计、导出共用的工作区累计指标与计数口径。
- `assets/js/workspace/data.js`
  可同步数据集与本地运行态的边界定义、快照与应用逻辑。
- `assets/js/ui/navigation-data.js`
  左侧导航入口、说明区标题和主动作元数据。
- `assets/js/ui/navigation-ui.js`
  导航按钮状态、滚动与右侧说明区刷新。
- `assets/js/ui/navigation.js`
  左侧导航控制器，负责舱段切换与模块级回刷。
- `assets/js/features/tavern/catalog.js`
  情绪词典、家族元数据与酒谱目录。
- `assets/js/features/tavern/analyze.js`
  文本哈希、情绪压缩和家族倾向判定。
- `assets/js/features/tavern/records.js`
  结果卡记录生成、ABV 推导和旧酒单归一化。
- `assets/js/features/tavern/logic.js`
  配方选择层，负责把分析结果映射到酒谱目录。
- `assets/js/features/tavern/stage.js`
  酒馆舞台、液面波动、状态切换与输入态预览。
- `assets/js/features/tavern/result.js`
  结果卡渲染、分享文案与当前特调展示。
- `assets/js/features/tavern/history.js`
  酒柜列表渲染、历史查看与删除交互。
- `assets/js/features/tavern/flow.js`
  输入控件同步、情绪分析动画与结果流转编排。
- `assets/js/features/tavern/ui.js`
  酒馆事件绑定层，负责把舞台、结果卡和历史酒柜组装成完整交互。
- `assets/js/features/tavern/index.js`
  深空酒馆入口，负责在 DOM 就绪后挂载酒馆交互。
- `assets/js/features/checkin/rules.js`
  值班状态归一化、时间判定、补录评估与记录写入。
- `assets/js/features/checkin/status.js`
  值班主按钮、时间文案与今日值班表的渲染层。
- `assets/js/features/checkin/retro.js`
  补打卡面板预判、额度展示与最近补录留痕渲染。
- `assets/js/features/checkin/summary.js`
  晚班收尾后的每日 / 每周总结弹窗。
- `assets/js/features/checkin/ui.js`
  值班渲染聚合层，提供统一的值班页刷新入口。
- `assets/js/features/checkin/index.js`
  值班控制器，负责实时打卡、补打卡提交与初始化监听。
- `assets/js/features/focus/achievements.js`
  戒断次数记录、成就判定与成就弹窗。
- `assets/js/workspace/entries.js`
  任务与速记共用的按日期写入、删除和轻量回刷工具。
- `assets/js/features/tasks/hero.js`
  当前任务首屏卡与进度条渲染。
- `assets/js/features/tasks/render.js`
  今日任务表格与事件视界时间轴渲染。
- `assets/js/features/tasks/index.js`
  任务控制器，负责开始/结束、计时器与任务刷新时机。
- `assets/js/features/notes/modal.js`
  速记弹窗、快捷键、焦点约束与输入计数。
- `assets/js/features/notes/today.js`
  今日捕捉池空状态与卡片渲染。
- `assets/js/features/notes/archive.js`
  历史归档分组、搜索结果与删除入口渲染。
- `assets/js/features/notes/render.js`
  速记渲染聚合层，负责今日捕捉池与归档区事件绑定。
- `assets/js/features/notes/index.js`
  速记控制器，负责保存记录并挂载速记模块。
- `assets/js/features/leave/rules.js`
  离舰工作流状态、目标日期校验与离舰状态重建。
- `assets/js/features/leave/ui.js`
  离舰流程切换、表单动态提示与历史列表渲染。
- `assets/js/features/leave/index.js`
  离舰控制器，负责时间下拉、提交与撤销监听。
- `assets/js/features/stats/data.js`
  顶部摘要所需的统计快照构建。
- `assets/js/features/stats/ranges.js`
  统计区间、月范围和图表桶日期工具。
- `assets/js/features/stats/aggregates.js`
  统计聚合、值班口径和图表数据准备。
- `assets/js/features/stats/charts.js`
  Chart.js 图表渲染与实例更新。
- `assets/js/features/stats/index.js`
  统计控制器，负责周期按钮、顶部摘要与图表刷新入口。
- `assets/js/features/dashboard/labels.js`
  状态徽章、班次标签和航行情绪文案派生。
- `assets/js/features/dashboard/overview.js`
  首页总览状态、下一动作和命令提示派生。
- `assets/js/features/dashboard/confirm.js`
  全局确认弹窗的展示、焦点恢复和键盘关闭。
- `assets/js/features/dashboard/toast.js`
  全局 toast 的创建、图标和退场动画。
- `assets/js/features/dashboard/status.js`
  首页总览、今日摘要和航行情绪提示。
- `assets/js/features/dashboard/ui.js`
  首页界面聚合层，负责把首页状态和速记列表刷新收口到统一入口。
- `assets/js/features/sync/state.js`
  云同步凭据、本地同步时间与自动同步计时器状态。
- `assets/js/features/sync/api.js`
  GitHub Gist 请求与响应解析。
- `assets/js/features/sync/ui.js`
  同步按钮态、配置表单读写和本地提示。
- `assets/js/features/sync/backup.js`
  云端覆盖前备份、恢复和数据替换回滚边界。
- `assets/js/features/sync/conflict.js`
  上传前云端版本检查、ETag 保护和冲突确认。
- `assets/js/features/sync/logic.js`
  拉取/推送流程和自动同步调度。
- `assets/js/features/sync/index.js`
  云同步入口，只负责挂载按钮事件并注册模块。
- `assets/js/features/export/profiles.js`
  导出档位定义、月份范围和文件名辅助函数。
- `assets/js/features/export/monthly.js`
  单月值班、任务、速记、离舰和酒单快照构建。
- `assets/js/features/export/data.js`
  全量工作区快照与全量导出摘要。
- `assets/js/features/export/formats.js`
  Markdown / CSV 序列化与导出文件描述生成。
- `assets/js/features/export/ui.js`
  导出面板的选择联动、预览更新与交互绑定。
- `assets/js/features/export/index.js`
  导出控制器，负责执行当前选中的下载动作。
- `assets/js/ui/shortcuts.js`
  全局快捷键层，负责舱段切换、循环浏览与快捷值班。
- `assets/js/runtime/app-init.js`
  DOM 就绪后的统一启动编排。
- `scripts/smoke-check.sh`
  常见回归场景的本地冒烟脚本。
- `scripts/check-runtime-state-contracts.js`
  运行时共享状态写入契约检查，阻止功能模块绕过 `runtimeActions` 直接改内存态。
- `scripts/check-release-governance.js`
  发布、安全、贡献、兼容和排障文档的治理检查，确保关键章节进入 release gate。
- `scripts/check-vendor-manifest.js`
  第三方浏览器脚本的 README、source URL、版本文件名和 checksum 清单一致性检查。
- `scripts/setup-browser-test.sh`
  根据环境文件创建或更新浏览器测试所需的 `conda` 环境。
- `scripts/browser-smoke.sh`
  Selenium 浏览器冒烟入口，默认 Firefox，也支持 `HM_CLSS_BROWSER=chromium`。
- `scripts/browser-smoke.py`
  浏览器级功能检查的启动脚本，按场景顺序编排执行。
- `scripts/browser_smoke/`
  浏览器冒烟共享 helper、driver 封装与分场景回归脚本。
- `scripts/smoke_manifest/`
  `smoke-check` 使用的清单目录，分别维护语法检查、脚本顺序、样式、文件、文档和关键 DOM id。
- `docs/testing-artifacts.md`
  浏览器冒烟工件目录、失败快照和视觉快照的落盘约定。
- `docs/commercial-readiness-audit.md`
  当前商业级工程成熟度审计、已验证证据和后续 release gate 优先级。
- `docs/release-checklist.md`
  发版前自动门禁、人工验收、数据安全和回滚检查单。
- `docs/release-validation.md`
  最近一轮自动化与浏览器级验收证据留痕。
- `docs/troubleshooting.md`
  本地数据、同步、导出、视觉和 vendor 异常排障指南。
- `docs/browser-support.md`
  浏览器支持矩阵、必需能力和发布验证期望。
- `docs/data-compatibility.md`
  本地存储 schema、迁移原则、云同步兼容和恢复流程。
- `docs/vendor-review.md`
  第三方浏览器脚本的版本、安全公告和升级复核节奏。
- `SECURITY.md`
  安全策略、敏感数据规则、漏洞报告和依赖升级流程。
- `CONTRIBUTING.md`
  开发流程、提交规范、测试要求和 PR 检查项。
- `CHANGELOG.md`
  未发布变更、验证记录和发版记录模板。
- `tests/fixtures/visual-layout-baselines.json`
  关键舱段的布局视觉基线，用于浏览器回归时对比主要面板是否漂移。
- `environment.browser-test.yml`
  浏览器测试环境的可复现依赖定义。
- `tests/unit/helpers.js`
  单测共享上下文、脚本加载和本地存储 mock。
- `tests/unit/browser-driver-contract.test.js`
  浏览器 smoke 入口和 Firefox/Chromium 驱动选择契约测试。
- `tests/unit/runtime-store-and-checkin.test.js`
  运行时状态、值班规则和首页状态映射测试。
- `tests/unit/runtime-state-contract-checker.test.js`
  运行时状态写入契约检查器测试，覆盖直接写入、旧 helper 回流和模板字符串表达式。
- `tests/unit/release-governance-checker.test.js`
  发布治理检查器测试，覆盖文档章节、README 引用和 required-docs 清单。
- `tests/unit/vendor-manifest-checker.test.js`
  vendor 资产清单检查器测试，覆盖 README、checksum 和 source URL 约束。
- `tests/unit/export-storage-workspace.test.js`
  导出构建、工作区快照和本地存储迁移测试。
- `tests/unit/module-registry.test.js`
  模块注册中心生命周期、依赖校验和延迟注册测试。
- `tests/unit/sync-controller.test.js`
  同步失败、冲突确认和控制器分支测试。
- `tests/unit/statistics-and-export.test.js`
  统计聚合与空月导出 fixture 测试。
- `docs/functional-self-check.md`
  面向发版前人工验收的功能级自测清单。


## 📡 深空通讯链路（云端同步）配置指南

为了防止本地数据在“星际辐射”中丢失，并实现多台设备的无缝切换，请按以下步骤配置你的私有云端同步。

### 第一步：获取 GitHub Token

1. 登录 GitHub，访问 [Developer Settings -> Personal Access Tokens (Tokens classic)](https://github.com/settings/tokens)。
2. 点击 **Generate new token (classic)**。
3. `Note` 可填写 `HM-CLSS-Sync`。
4. `Expiration` 可按你的安全习惯设置；若是私人长期使用，可考虑更长时限。
5. **只勾选 `gist` 权限**。
6. 点击生成，并保存这串 Token。离开页面后将无法再次查看。

### 第二步：创建 Gist 容器

1. 打开 [GitHub Gist](https://gist.github.com/)。
2. `Filename` 填写：`workspace_data.json`
3. 内容输入：`{}`
4. 点击 **Create secret gist**
5. 创建成功后，复制 URL 最后一段长字符串，即你的 **Gist ID**

### 第三步：在系统中激活

1. 打开 HM-CLSS，进入 **深空通讯设置**
2. 填入 **GitHub Token** 与 **Gist ID**
3. 点击 **保存配置**
   `GitHub Token` 只保存在当前浏览器会话里；关闭标签页或浏览器后需要重新填写。`Gist ID` 会继续保留在本地。
4. 首次使用时，点击 **上传覆盖云端** 初始化你的远端数据舱

之后系统会在数据变化后进行节流式自动同步。


## 🛠️ 自定义改装指南

如果你想根据自己的作息、科研习惯或个人审美进行改造，请优先修改以下位置。

### 1. 自定义“成就图鉴”

在 `assets/js/runtime/state.js` 中找到 `const achievementList = [...]`。

示例：

```javascript
{
    id: 'my_custom_id',
    name: '你的成就名',
    description: '你的成就描述',
    requirement: 50,
    type: 'task'
}
```

`type` 可选说明：

- 留空或 `phone`：戒断次数
- `checkin`：出勤天数
- `streak`：连续出勤天数
- `task`：任务数量
- `task_hour`：任务总时长
- `notes`：速记条数

### 2. 自定义“科研任务分类”

在 `assets/js/runtime/state.js` 中找到：

```javascript
const tagMap = {
    paper: '文献阅读',
    code: '代码构建',
    experiment: '实验跑数',
    write: '文档撰写',
    other: '杂项事务'
};
```

修改右侧中文文案即可变更系统中的任务标签显示。

注意：如果你改了分类语义，也要同步修改 `index.html` 中任务输入区域 `<select id="task-tag">` 的选项文案。

### 3. 自定义“维生巡检时间窗口”

在 `assets/js/runtime/state.js` 中找到 `const CONFIG = {...}`。

```javascript
const CONFIG = {
    schedule: {
        morning:   { startHour: 6,  endHour: 12, okCheckInBefore: 8,  okCheckOutBefore: 12 },
        afternoon: { startHour: 12, endHour: 17, okCheckInBefore: 14, okCheckOutBefore: 18 },
        evening:   { startHour: 17, endHour: 22, okCheckInBefore: 19, okCheckOutBefore: 22 }
    },
    task: {
        minDurationMins: 30
    }
};
```

含义如下：

- `startHour`：该班次允许开始打卡的时间
- `endHour`：该班次允许打卡的截止时间
- `okCheckInBefore`：在此时间前连线视为合格
- `okCheckOutBefore`：登出的标准时间
- `minDurationMins`：任务被视为有效的最短持续时长

如果你修改了时间逻辑，也记得同步调整 `index.html` 中展示给用户的时段提示文案。

### 4. 自定义“系统主题色”

当前主题色通过 `assets/css/theme.css` 顶部的 `:root` 颜色令牌驱动，`index.html` 里的 `tailwind.config` 只是消费这些变量。

```css
:root {
    --color-primary: 77 163 255;
    --color-primary-hover: 45 134 227;
    --color-accent: 243 179 91;
    --color-success: 52 211 153;
    --color-warning: 246 197 109;
    --color-danger: 251 113 133;
}
```

直接替换这些 RGB 数值即可；如果你同时改了背景或卡面气氛色，也记得同步调整同一区域里的 `--color-bg-*` 与 `--color-card-*`。

### 5. 自定义脚本与启动顺序

新增或调整脚本时，以 [`script-order.txt`](./scripts/smoke_manifest/script-order.txt) 为唯一加载顺序清单；`index.html` 的脚本块由 smoke check 自动校验。目录按 `runtime / workspace / ui / features` 分层：`runtime` 负责启动、模块注册、共享运行时和可变状态容器，`workspace` 负责跨模块共享的数据与口径，`ui` 负责导航和快捷键这类外层交互，`features` 按值班、酒馆、离舰、统计、同步、导出等功能继续拆分。

`app-init.js` 现在只负责 `initData()` 和触发模块注册中心，具体功能模块各自向注册中心报到。顺序错乱会导致飞船在启动时失压。

新增或调整业务数据时，优先通过 `runtimeActions` 写入共享状态，再由 `saveData()` 统一持久化和刷新统计/导出预览。只有兼容旧 helper 或纯读取场景才直接访问 `checkinData`、`taskData` 等全局代理。新增 `registerAppModule` 时必须声明稳定 `id`；如果依赖其他模块或脚本，补齐 `dependsOn`，并让 `order` 晚于依赖模块的初始化顺序。


## 🧪 手动巡检建议

当前仓库已经有两层基础回归：

- `bash scripts/smoke-check.sh`
  做脚本语法、关键 DOM id 和脚本顺序巡检。
- `bash scripts/setup-browser-test.sh`
  创建或更新真实浏览器测试所需的 `conda` 环境。
- `bash scripts/browser-smoke.sh`
  在 Firefox + Selenium 中做关键交互冒烟、布局视觉基线校验，并在失败时留下截图和页面工件。
- `powershell -ExecutionPolicy Bypass -File scripts/smoke-check.ps1`
  Windows 入口，自动解析 Git Bash、项目内 Python 和本机 Node。
- `powershell -ExecutionPolicy Bypass -File scripts/browser-smoke.ps1`
  Windows 浏览器冒烟入口，默认复用 `.conda/browser-test`。

自动化之外，发版前仍建议按 [docs/functional-self-check.md](./docs/functional-self-check.md) 做一轮功能级人工巡检，尤其是下面这些高风险舱段：

- 左侧导航切换是否正常
- 早/中/晚打卡与今日状态是否同步刷新
- 手机干扰记录与成就是否正常累加
- 任务开始、结束、恢复、时间轴显示是否正常
- `Ctrl+K` 速记、归档搜索、删除是否正常
- 离舰报备与撤销是否影响今日状态
- 统计图表在不同周期下是否正常刷新
- GitHub Gist 推送/拉取是否符合预期
- 全量导出、本月 JSON 与本月 Markdown 是否都能正常下载
- 深色模式切换后图表与图标是否同步更新


## 🗺️ 航星路线图

当前系统已经完成第一轮结构重整，但航线还没有结束。

### 已完成

- [x] 将庞大的内联逻辑拆分为多个原生 JS 文件
- [x] 按职责划分任务、速记、统计、同步、状态 UI 等模块
- [x] 保持零构建、零后端的部署方式不变

### 下一阶段

- [x] 将原 `core.js` 中的共享状态、存储与启动流程拆分到 `runtime`、`workspace` 和功能模块
- [x] 将主题色进一步变量化，降低样式硬编码密度
- [x] 为常见回归场景补充更稳定的自动化测试脚本
- [x] 增强键盘操作流，例如快捷切换舱段与快捷打卡
- [x] 加入更完整的数据导出能力，例如月度报告或结构化导出


## 📄 开源协议

本项目采用 [MIT License](./LICENSE) 授权。


## 🎉 特别鸣谢

本项目在小红书用户 **@yuyu** 的原创设计基础上衍生开发，并已获得原作者的修改与开源授权。感谢 **@yuyu** 提供的优秀开源。

欢迎任何形式的 Fork 与改造，愿你在星辰大海中保持专注，早日拯救地球。
