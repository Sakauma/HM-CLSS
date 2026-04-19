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


## 🗂️ 舰体结构

当前仓库的主结构如下：

- `index.html`
  飞船主舱。负责页面骨架、Tailwind 配置、自定义样式，以及脚本加载顺序。
- `assets/js/theme.js`
  主题切换与深浅色图标同步。
- `assets/js/core.js`
  全局状态、基础配置、存储初始化、通用工具函数、启动引导。
- `assets/js/navigation.js`
  左侧导航与舱段切换。
- `assets/js/tavern.js`
  深空酒馆的情绪分析、配方生成与历史酒单。
- `assets/js/checkin.js`
  考勤打卡、时段判定、今日打卡状态表。
- `assets/js/phone-achievements.js`
  戒断次数记录、成就判定与成就弹窗。
- `assets/js/tasks.js`
  任务开始/结束、计时器、任务表格与时间轴。
- `assets/js/notes.js`
  `Ctrl+K` 快速记录、归档面板、笔记检索与删除。
- `assets/js/leave.js`
  全天/分时段离舰报备与撤销逻辑。
- `assets/js/stats.js`
  统计区间、图表数据准备、图表渲染、汇总统计。
- `assets/js/status-ui.js`
  今日状态面板与通用 Toast 提示。
- `assets/js/sync.js`
  GitHub Gist 配置、手动推送/拉取、自动同步与云端数据合并。


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

在 `assets/js/core.js` 中找到 `const achievementList = [...]`。

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

在 `assets/js/core.js` 中找到：

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

在 `assets/js/core.js` 中找到 `const CONFIG = {...}`。

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

在 `index.html` 顶部的 `tailwind.config` 中找到 `colors`：

```javascript
colors: {
    primary: '#4da3ff',
    primaryHover: '#2d86e3',
    accent: '#f3b35b',
    success: '#34d399',
    warning: '#f6c56d',
    danger: '#fb7185'
}
```

直接替换为你想要的 HEX 色值即可。

### 5. 自定义“脚本加载顺序”

如果你未来继续拆分脚本，不要随意打乱 `index.html` 中的 `<script src="assets/js/...">` 顺序。

当前顺序遵循依赖关系：

1. `theme.js`
2. `core.js`
3. `navigation.js`
4. `tavern.js`
5. `checkin.js`
6. `phone-achievements.js`
7. `tasks.js`
8. `notes.js`
9. `leave.js`
10. `stats.js`
11. `status-ui.js`
12. `sync.js`

前面的文件负责提供状态与函数，后面的文件负责调用它们。顺序错乱会导致飞船在启动时失压。


## 🧪 手动巡检建议

当前仓库没有正式的自动化测试套件，因此每次改动后建议至少人工巡检以下舱段：

- 左侧导航切换是否正常
- 早/中/晚打卡与今日状态是否同步刷新
- 手机干扰记录与成就是否正常累加
- 任务开始、结束、恢复、时间轴显示是否正常
- `Ctrl+K` 速记、归档搜索、删除是否正常
- 离舰报备与撤销是否影响今日状态
- 统计图表在不同周期下是否正常刷新
- GitHub Gist 推送/拉取是否符合预期
- 深色模式切换后图表与图标是否同步更新


## 🗺️ 航星路线图

当前系统已经完成第一轮结构重整，但航线还没有结束。

### 已完成

- [x] 将庞大的内联逻辑拆分为多个原生 JS 文件
- [x] 按职责划分任务、速记、统计、同步、状态 UI 等模块
- [x] 保持零构建、零后端的部署方式不变

### 下一阶段

- [ ] 继续抽离 `core.js` 中的共享状态、存储与启动流程
- [ ] 将主题色进一步变量化，降低样式硬编码密度
- [ ] 为常见回归场景补充更稳定的自动化测试脚本
- [ ] 增强键盘操作流，例如快捷切换舱段与快捷打卡
- [ ] 加入更完整的数据导出能力，例如月度报告或结构化导出


## 📄 开源协议

本项目采用 [MIT License](./LICENSE) 授权。


## 🎉 特别鸣谢

本项目在小红书用户 **@yuyu** 的原创设计基础上衍生开发，并已获得原作者的修改与开源授权。感谢 **@yuyu** 提供的优秀开源。

欢迎任何形式的 Fork 与改造，愿你在星辰大海中保持专注，早日拯救地球。
