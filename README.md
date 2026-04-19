# HM-CLSS
风格化的自我管理打卡系统

> “你现在的首要任务，就是活下去，然后拯救地球。”

**HM-CLSS (Hail Mary Crew Life Support System)** 是一套以《挽救计划》为灵感的前端维生系统。它负责记录你的唤醒状态、科研供能、干扰阻断、离舰报备，以及跨设备的数据漂流。

本项目当前采用 **纯前端、零构建** 架构：

- 页面外壳：`index.html`
- 样式渲染：Tailwind CDN + 自定义 CSS
- 行为逻辑：Vanilla JavaScript
- 数据存储：浏览器 `localStorage`
- 云端同步：GitHub Gist API


## 🚀 核心维生模块

- **航星维生日志（考勤系统）**：划分为早、中、晚三个象限，记录连线与登出状态，并判定是否合规。
- **多巴胺戒断阻断（专注力记录）**：记录对抗碎片化信息干扰的次数，并联动成就图鉴。
- **核心科研阵列（任务管理）**：提供任务计时、任务归档与 18 小时制“事件视界”时间轴映射。
- **噬星体捕捉池（速记系统）**：通过全局快捷键 `Ctrl+K` 快速记录灵感、日志、异常与待办。
- **休眠与离舰报备（请假系统）**：支持全天离舰与分时段离舰。
- **深空酒馆（情绪特调）**：根据输入文本生成情绪配方，并保存到酒柜历史。
- **全舰效能雷达（数据分析）**：多维图表展示考勤、任务与干扰拦截数据。
- **深空通讯链路（云端同步）**：通过 GitHub Gist 在不同设备间同步本地数据。


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

### 脚本语法巡检

```bash
node --check assets/js/runtime/theme.js
node --check assets/js/runtime/state.js
node --check assets/js/runtime/storage.js
node --check assets/js/runtime/core.js
node --check assets/js/workspace/metrics.js
node --check assets/js/workspace/data.js
node --check assets/js/ui/navigation.js
node --check assets/js/features/tavern/catalog.js
node --check assets/js/features/tavern/logic.js
node --check assets/js/features/tavern/ui.js
node --check assets/js/features/tavern/index.js
node --check assets/js/features/checkin/rules.js
node --check assets/js/features/checkin/ui.js
node --check assets/js/features/checkin/index.js
node --check assets/js/features/focus/achievements.js
node --check assets/js/workspace/entries.js
node --check assets/js/features/tasks/index.js
node --check assets/js/features/notes/index.js
node --check assets/js/features/leave/rules.js
node --check assets/js/features/leave/ui.js
node --check assets/js/features/leave/index.js
node --check assets/js/features/stats/data.js
node --check assets/js/features/stats/charts.js
node --check assets/js/features/stats/index.js
node --check assets/js/features/dashboard/copy.js
node --check assets/js/features/dashboard/ui.js
node --check assets/js/features/sync/state.js
node --check assets/js/features/sync/api.js
node --check assets/js/features/sync/index.js
node --check assets/js/features/export/data.js
node --check assets/js/features/export/formats.js
node --check assets/js/features/export/ui.js
node --check assets/js/features/export/index.js
node --check assets/js/ui/shortcuts.js
node --check assets/js/runtime/app-init.js
python3 -m py_compile scripts/browser-smoke.py
bash -n scripts/browser-smoke.sh
bash -n scripts/setup-browser-test.sh
```

### 快速回归脚本

```bash
bash scripts/smoke-check.sh
```

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

可选环境变量：

- `HM_CLSS_BROWSER_ENV`
  覆盖默认的 `conda` 环境路径。
- `HM_CLSS_BROWSER_ENV_FILE`
  覆盖默认的浏览器测试环境文件路径。
- `HM_CLSS_CONDA_SOLVER`
  覆盖默认求解器；脚本默认使用 `classic` 以兼容缺少 `libmamba` 的 `conda` 安装。
- `HM_CLSS_SMOKE_URL`
  指向自定义预览地址；未提供时默认使用 `http://127.0.0.1:8000`。


## 🗂️ 舰体结构

当前仓库的主结构如下：

- `index.html`
  飞船主舱。负责页面骨架、Tailwind 配置、自定义样式，以及脚本加载顺序。
- `assets/js/runtime/theme.js`
  主题切换与深浅色图标同步。
- `assets/js/runtime/state.js`
  全局共享状态、配置常量、标签映射与情绪/成就静态清单。
- `assets/js/runtime/storage.js`
  本地存储初始化、结构归一化、持久化与当前任务恢复。
- `assets/js/runtime/core.js`
  时间工具、环境态派生、任务首屏状态与通用转义函数。
- `assets/js/workspace/metrics.js`
  成就、统计、导出共用的工作区累计指标与计数口径。
- `assets/js/workspace/data.js`
  可同步数据集与本地运行态的边界定义、快照与应用逻辑。
- `assets/js/ui/navigation.js`
  左侧导航与舱段切换。
- `assets/js/features/tavern/catalog.js`
  情绪词典、家族元数据与酒谱目录。
- `assets/js/features/tavern/logic.js`
  情绪解析、配方选择、结果记录生成与旧酒单归一化。
- `assets/js/features/tavern/ui.js`
  酒馆舞台动画、结果卡、历史酒柜与事件绑定。
- `assets/js/features/tavern/index.js`
  深空酒馆入口，负责在 DOM 就绪后挂载酒馆交互。
- `assets/js/features/checkin/rules.js`
  值班状态归一化、时间判定、补录评估与记录写入。
- `assets/js/features/checkin/ui.js`
  值班按钮、今日记录表、补打卡面板和每日/每周彩蛋弹窗。
- `assets/js/features/checkin/index.js`
  值班控制器，负责实时打卡、补打卡提交与初始化监听。
- `assets/js/features/focus/achievements.js`
  戒断次数记录、成就判定与成就弹窗。
- `assets/js/workspace/entries.js`
  任务与速记共用的按日期写入、删除和轻量回刷工具。
- `assets/js/features/tasks/index.js`
  任务开始/结束、计时器、任务表格与时间轴。
- `assets/js/features/notes/index.js`
  `Ctrl+K` 快速记录、归档面板、笔记检索与删除。
- `assets/js/features/leave/rules.js`
  离舰工作流状态、目标日期校验与离舰状态重建。
- `assets/js/features/leave/ui.js`
  离舰流程切换、表单动态提示与历史列表渲染。
- `assets/js/features/leave/index.js`
  离舰控制器，负责时间下拉、提交与撤销监听。
- `assets/js/features/stats/data.js`
  统计区间、时间范围、聚合口径与图表数据准备。
- `assets/js/features/stats/charts.js`
  Chart.js 图表渲染与实例更新。
- `assets/js/features/stats/index.js`
  统计控制器，负责周期按钮、顶部摘要与图表刷新入口。
- `assets/js/features/dashboard/copy.js`
  状态徽章、班次标签和首页总览文案派生。
- `assets/js/features/dashboard/ui.js`
  今日状态面板渲染、航行情绪刷新与通用 Toast 提示。
- `assets/js/features/sync/state.js`
  云同步凭据、本地同步时间与自动同步计时器状态。
- `assets/js/features/sync/api.js`
  GitHub Gist 请求与响应解析。
- `assets/js/features/sync/index.js`
  云同步控制器，负责按钮交互、冲突确认、自动同步与云端数据应用。
- `assets/js/features/export/data.js`
  导出配置、工作区快照、月度快照和预览摘要口径。
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
- `scripts/setup-browser-test.sh`
  根据环境文件创建或更新浏览器测试所需的 `conda` 环境。
- `scripts/browser-smoke.sh`
  真实 Firefox + Selenium 的浏览器冒烟入口。
- `scripts/browser-smoke.py`
  浏览器级功能检查的具体执行脚本。
- `environment.browser-test.yml`
  浏览器测试环境的可复现依赖定义。
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

当前主题色通过 `index.html` 顶部的 `:root` 颜色令牌驱动，`tailwind.config` 只是消费这些变量。

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

### 5. 自定义“脚本加载顺序”

如果你未来继续拆分脚本，不要随意打乱 `index.html` 中的 `<script src="assets/js/...">` 顺序。

当前顺序遵循依赖关系：

1. `runtime/theme.js`
2. `runtime/state.js`
3. `runtime/storage.js`
4. `runtime/core.js`
5. `workspace/metrics.js`
6. `workspace/data.js`
7. `runtime/app-init.js`
8. `ui/navigation.js`
9. `features/tavern/catalog.js`
10. `features/tavern/logic.js`
11. `features/tavern/ui.js`
12. `features/tavern/index.js`
13. `features/checkin/rules.js`
14. `features/checkin/ui.js`
15. `features/checkin/index.js`
16. `features/focus/achievements.js`
17. `workspace/entries.js`
18. `features/tasks/index.js`
19. `features/notes/index.js`
20. `features/leave/rules.js`
21. `features/leave/ui.js`
22. `features/leave/index.js`
23. `features/stats/data.js`
24. `features/stats/charts.js`
25. `features/stats/index.js`
26. `features/dashboard/copy.js`
27. `features/dashboard/ui.js`
28. `features/sync/state.js`
29. `features/sync/api.js`
30. `features/sync/index.js`
31. `features/export/data.js`
32. `features/export/formats.js`
33. `features/export/ui.js`
34. `features/export/index.js`
35. `ui/shortcuts.js`

现在目录按 `runtime / workspace / ui / features` 分层：`runtime` 负责启动与共享运行时，`workspace` 负责跨模块共享的数据与口径，`ui` 负责导航和快捷键这类外层交互，`features` 按值班、酒馆、离舰、统计、同步、导出等功能继续拆分。顺序错乱会导致飞船在启动时失压。


## 🧪 手动巡检建议

当前仓库已经有两层基础回归：

- `bash scripts/smoke-check.sh`
  做脚本语法、关键 DOM id 和脚本顺序巡检。
- `bash scripts/setup-browser-test.sh`
  创建或更新真实浏览器测试所需的 `conda` 环境。
- `bash scripts/browser-smoke.sh`
  在 Firefox + Selenium 中做关键交互冒烟。

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

- [x] 继续抽离 `core.js` 中的共享状态、存储与启动流程
- [x] 将主题色进一步变量化，降低样式硬编码密度
- [x] 为常见回归场景补充更稳定的自动化测试脚本
- [x] 增强键盘操作流，例如快捷切换舱段与快捷打卡
- [x] 加入更完整的数据导出能力，例如月度报告或结构化导出


## 📄 开源协议

本项目采用 [MIT License](./LICENSE) 授权。


## 🎉 特别鸣谢

本项目在小红书用户 **@yuyu** 的原创设计基础上衍生开发，并已获得原作者的修改与开源授权。感谢 **@yuyu** 提供的优秀开源。

欢迎任何形式的 Fork 与改造，愿你在星辰大海中保持专注，早日拯救地球。
