# HM-CLSS
《挽救计划》主题的前端个人维生系统

> “你现在的首要任务，就是活下去，然后拯救地球。”

**HM-CLSS (Hail Mary Crew Life Support System)** 是一套以《挽救计划》为灵感的零构建前端应用。它把日常打卡、深度工作、速记、离舰报备、情绪记录和云端同步收拢进一套统一的“舰桥工作台”界面里，强调首屏可操作、信息层级清晰，以及在深浅主题下都保持稳定可读性。

## 项目特性

- **零构建、纯前端**
  只需浏览器和本地静态服务器即可运行，无需安装依赖或启动后端。
- **舰桥式 UI / UX**
  高优先级操作前置，历史记录和复盘信息后置，减少“进入页面先找按钮”的负担。
- **模块化脚本结构**
  页面骨架保留在 `index.html`，业务逻辑拆分到 `assets/js/*.js`，便于继续迭代。
- **本地优先**
  所有数据默认存储在浏览器 `localStorage` 中，刷新后可恢复。
- **跨设备同步**
  支持通过 GitHub Gist 把本地数据推送到云端，或从云端拉回。
- **主题一致**
  当前视觉基线围绕“深空维生终端 / 舰桥工作台”展开，避免过度游戏 HUD 化和廉价赛博风。

## 核心模块

- **舰桥值班与今日状态**
  记录 Alpha / Beta / Gamma 三段值班状态，并根据时间窗口给出当前建议。
- **认知干扰拦截**
  记录当天成功抵抗碎片化干扰的次数，并联动成就图鉴。
- **全舰任务管理**
  支持开启深度工作、进行中任务计时、任务日志回看和事件视界时间轴。
- **噬星体捕捉池**
  通过 `Ctrl + K` 快速记录灵感、异常、待办和航行日志。
- **全舰日志归档**
  集中检索历史任务、速记和异常记录。
- **离舰活动审批**
  支持全天离舰和分时段离舰，并影响当天值班判定。
- **效能洞察**
  用图表展示考勤、专注时长、干扰拦截等长期趋势。
- **深空情绪吧台**
  根据情绪输入生成配方化结果，并保存到酒单档案。
- **云端同步中心**
  管理 GitHub Token、Gist ID、本地与云端数据的拉取和上传覆盖。

## 技术栈

- **页面结构**：`index.html`
- **样式系统**：Tailwind CDN + 自定义 CSS
- **交互逻辑**：Vanilla JavaScript
- **数据存储**：浏览器 `localStorage`
- **图表**：Chart.js CDN
- **Markdown 渲染**：Marked + DOMPurify
- **图标**：Lucide

## 启动方式

### 本地静态服务

```bash
python3 -m http.server 8000
```

然后访问：

```text
http://127.0.0.1:8000
```

### 快速预览

也可以直接在浏览器中打开 `index.html` 做简单视觉冒烟测试，但涉及 `fetch` 或路径依赖时，仍建议使用本地静态服务器。

### 脚本语法检查

```bash
node --check assets/js/theme.js
node --check assets/js/core.js
node --check assets/js/navigation.js
node --check assets/js/tavern.js
node --check assets/js/checkin.js
node --check assets/js/phone-achievements.js
node --check assets/js/tasks.js
node --check assets/js/notes.js
node --check assets/js/leave.js
node --check assets/js/stats.js
node --check assets/js/status-ui.js
node --check assets/js/sync.js
```

## 项目结构

```text
HM-CLSS/
├── index.html
├── assets/
│   └── js/
│       ├── core.js
│       ├── theme.js
│       ├── navigation.js
│       ├── checkin.js
│       ├── leave.js
│       ├── tasks.js
│       ├── notes.js
│       ├── tavern.js
│       ├── stats.js
│       ├── sync.js
│       ├── status-ui.js
│       └── phone-achievements.js
├── AGENTS.md
├── LICENSE
└── README.md
```

### 关键文件说明

- `index.html`
  页面骨架、自定义样式、模块挂载点，以及与 DOM 紧耦合的 UI 结构。
- `assets/js/core.js`
  全局常量、存储初始化、通用工具、当前任务持久化等共享逻辑。
- `assets/js/theme.js`
  明暗主题切换与全局视觉状态同步。
- `assets/js/navigation.js`
  左侧导航、模块切换、顶部状态说明和模块间滚动定位。
- `assets/js/checkin.js`
  值班连线、登出和今日值班表。
- `assets/js/tasks.js`
  深度工作开始/结束、任务日志和时间轴。
- `assets/js/notes.js`
  快记弹窗、快捷键、记录渲染与归档交互。
- `assets/js/leave.js`
  离舰类型、时间段和请假记录。
- `assets/js/tavern.js`
  情绪吧台、结果生成与酒单历史。
- `assets/js/stats.js`
  周期切换、统计图表和汇总数据。
- `assets/js/status-ui.js`
  今日状态总览、提示和 Toast。
- `assets/js/sync.js`
  GitHub Gist 配置、拉取、推送和自动同步。

## 当前 UI / UX 方向

本项目当前不再是“单页功能堆叠”，而是围绕以下几条原则迭代：

- **首屏先给操作，不先给解释**
  高频模块进入后优先看到主按钮和主输入区。
- **历史与复盘后置**
  日志、图表、归档和长表格放在次级区域，必要时使用局部滚动。
- **统一卡片体系**
  主要模块都收进同一套卡片视觉语言，避免散装 banner 和风格断裂。
- **深浅主题双适配**
  关键输入、下拉、按钮和状态色在暗黑模式下不失真。
- **世界观保留但不妨碍理解**
  保留“舰桥”“离舰”“酒单”等语境，但交互路径足够直白。

## GitHub Gist 同步配置

### 1. 获取 GitHub Token

1. 登录 GitHub。
2. 打开 [Developer Settings -> Personal Access Tokens (classic)](https://github.com/settings/tokens)。
3. 生成一个新 Token。
4. 只勾选 `gist` 权限。
5. 保存生成后的 Token。

### 2. 创建 Gist 容器

1. 打开 [GitHub Gist](https://gist.github.com/)。
2. 新建一个 Secret Gist。
3. 文件名可填写 `workspace_data.json`。
4. 内容先填 `{}`。
5. 创建后复制 URL 最后一段字符串，作为 **Gist ID**。

### 3. 在系统中配置

1. 打开 HM-CLSS。
2. 进入 **云端同步中心**。
3. 填入 **GitHub Token** 和 **Gist ID**。
4. 点击 **保存配置**。
5. 首次使用时，执行一次 **上传覆盖云端** 初始化远端数据。

## 可自定义项

### 成就系统

在 `assets/js/core.js` 中修改成就配置列表，可以扩展新的成就。

### 任务分类

在 `assets/js/core.js` 中调整 `tagMap`，并同步更新 `index.html` 中 `task-tag` 下拉的选项文本。

### 值班时间窗口

在 `assets/js/core.js` 中修改 `CONFIG.schedule`，可调整 Alpha / Beta / Gamma 的起止时间和判定逻辑。

### 主题配色

在 `index.html` 顶部的 `tailwind.config` 中可调整当前主题色：

```javascript
colors: {
    primary: '#4da3ff',
    primaryHover: '#2d86e3',
    accent: '#f3b35b',
    success: '#34d399',
    warning: '#f6c56d',
    danger: '#fb7185',
    bgLight: '#eaf1f6',
    bgDark: '#07141f',
    cardLight: '#f7fbff',
    cardDark: '#0f2131'
}
```

### 脚本加载顺序

不要随意打乱 `index.html` 底部脚本顺序。当前顺序遵循模块依赖，错误排序会导致初始化失败。

## 手动验证建议

在没有自动化测试的前提下，每次改动后建议至少验证以下流程：

- 左侧导航切换是否正常，切换后是否落到当前模块顶部
- 三段值班的连线 / 登出 / 今日记录是否同步更新
- 干扰拦截次数、今日记录和成就是否正常变化
- 任务开始、进行中计时、结束归档和时间轴是否正常
- `Ctrl + K` 快记、归档检索和删除是否正常
- 离舰报备与撤销是否正确影响今日状态
- 统计图表在不同周期下是否正常刷新
- 情绪吧台的输入、生成、保存酒单和历史切换是否正常
- GitHub Gist 的保存配置、拉取和上传覆盖是否符合预期
- 深浅主题切换后，下拉、图表、按钮和状态色是否保持可读

建议至少覆盖 `375px / 768px / 1024px / 1440px` 四档视口做人工检查。

## 许可

本项目采用 [MIT License](./LICENSE)。
