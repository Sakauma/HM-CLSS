# HM-CLSS
风格化的自我管理打卡系统

> “你现在的首要任务，就是活下去，然后拯救地球。”

**HM-CLSS (Hail Mary Crew Life Support System)** 是一款风格化的自我管理与打卡系统。灵感来自于《挽救计划》。

本系统采用纯前端架构（HTML + Tailwind CSS + Vanilla JS），无需额外部署后端，开箱即用。



## 🚀 核心维生模块

* **航星维生日志 (考勤系统)**：划分为三个象限（早、中、晚），严格记录唤醒与休眠状态，智能判定工作合规性。
* **多巴胺戒断阻断 (专注力记录)**：记录并追踪对抗碎片化信息（手机）干扰的次数，内置科幻风格的“成就图鉴”。
* **核心科研阵列 (任务管理)**：记录深度工作任务，包含实时计时器与18小时制的“事件视界”时间轴映射。内置 **噬星体捕捉池** (全局快捷键 `Ctrl+K`)，随时速记灵感。
* **休眠与离舰报备 (请假系统)**：规范化记录离线与身体不适状态。
* **全舰效能雷达 (数据分析)**：多维度图表展示考勤合规率、科研供能分布及干扰拦截指数，自动换算“维生能源(Sols)”。
* **深空通讯链路 (云端同步)**：基于 GitHub Gist API 的跨设备数据漫游，支持自动备份。



## 📡 深空通讯链路 (云端同步) 配置指南

为了防止本地数据在“星际辐射”中丢失，并实现多台设备的无缝切换，请按照以下步骤配置你的私有云端同步：

### 第一步：获取 GitHub Token
1. 登录你的 GitHub 账号，访问 [Developer Settings -> Personal Access Tokens (Tokens (classic))](https://github.com/settings/tokens)。
2. 点击 **Generate new token (classic)**。
3. 随便填写一个 Note（例如 `HM-CLSS-Sync`），Expiration 建议设置为 `No expiration`（永不过期）。
4. **【关键】** 在 Select scopes 列表中，**只勾选 `gist`** 这一项（Create and update gists）。
5. 点击 Generate，**复制并保存好这串以 `ghp_` 开头的密钥**（离开页面后将无法再次查看）。

### 第二步：创建 Gist 容器
1. 访问 [GitHub Gist](https://gist.github.com/)。
2. 在 `Filename` 中填写 `workspace_data.json`。
3. 在正文框中随便输入一对大括号 `{}`。
4. 点击右下角的 **Create secret gist**（创建私有 Gist，保护隐私）。
5. 创建成功后，观察浏览器地址栏的 URL，例如：`https://gist.github.com/yourname/8a7b6c5d4e3f2g1h`。
6. **复制 URL 最后的这串长字符**（如 `8a7b6c5d4e3f2g1h`），这就是你的 **Gist ID**。

### 第三步：在系统中激活
1. 打开 HM-CLSS 系统，进入左侧导航栏的 **深空通讯设置**。
2. 将刚才获取的 **GitHub Token** 和 **Gist ID** 分别填入对应输入框。
3. 点击 **保存配置**。随后点击 **上传覆盖云端**，初始化你的云端数据库！
*(之后系统会在你操作后自动进行静默云备份)*


## 🛠️ 自定义修改教程

如果你想根据自己的作息或工作性质修改系统，可以使用任意代码编辑器打开 `index.html`：

### 1. 自定义“成就图鉴”
在代码中找到 `const achievementList = [...]` 数组。你可以照猫画虎地添加或修改成就：
```javascript
{ 
    id: 'my_custom_id',          // 唯一的英文ID 
    name: '你的成就名',           // 界面显示的标题
    description: '你的成就描述',  // 界面显示的简介
    requirement: 50,             // 达标需要的数量
    type: 'task'                 // 统计类型（留空=戒手机次数, checkin=出勤天数, streak=连击天数, task=任务数, task_hour=任务总时长, notes=灵感记录数）
}
````

### 2. 自定义“科研任务分类”

在代码中找到 `const tagMap`：

```javascript
const tagMap = { 
    'paper': '文献阅读', 
    'code': '代码构建', 
    'experiment': '实验跑数', 
    'write': '文档撰写', 
    'other': '杂项事务' 
};
````

修改右侧的中文字符串，即可更改全系统中的任务标签名称。*(注意：也要同步修改 HTML 搜索区段 `<select id="task-tag">` 里面的文案)*。

### 3. 自定义“系统主题色”
本系统使用 Tailwind CSS 进行样式渲染。在代码顶部的 `<script>` 标签内，找到 `tailwind.config` 设置：
```javascript
colors: {
    primary: '#6366f1',       // 全局主色调 (默认科幻蓝，可改为你喜欢的 HEX 色值)
    primaryHover: '#4f46e5',  // 按钮悬浮时的加深色
    success: '#10b981',       // 合规/成功的颜色 (默认翠绿)
    warning: '#f59e0b',       // 警告/超时的颜色 (默认橙黄)
    danger: '#ef4444',        // 异常/失败的颜色 (默认赤红)
    // ...
}
```

### 4. 自定义“维生巡检时间窗口”
如果你要修改时间段，需要修改早中晚的打卡判定时间，你需要同时修改两处：
1. **界面显示**：在 HTML 代码中搜索 `06:00 - 12:00` 等文本，修改为你想要的提示文案。
2. **底层判定逻辑**：
   - 搜索 `function updateCheckinButtons()`：修改里面的 `currentHour < 6 || currentHour >= 12` 限制按钮能否点击的时间范围。
   - 搜索 `function checkIn(period)`：修改里面的 `now.hour < 8` 判定上班是否合规。
   - 搜索 `function checkOut(period)`：修改里面的 `now.hour < 12` 判定下班是否合规。


## 🗺️ 航星路线图 (Todo List)

当前系统仍在持续迭代中，以下是未来的开发计划：

### ⚙️ 代码重构与优化

- [ ] **模块化拆分**：将目前庞大的单文件 `index.html` 拆分为独立的 HTML、CSS 和 JS 模块，便于长期维护。
- [ ] **引入构建工具**：考虑迁移至 Vite 环境，或使用轻量级前端框架（如 Vue 3 / React）重构底层状态管理。
- [ ] **CSS 变量化**：将 Tailwind 中硬编码的主题色抽离为 CSS 变量，支持未来动态切换主题。

### ✨ 新功能特性

- [ ] **番茄钟 (Pomodoro) 融合**：在“核心科研阵列”中加入 25/5 分钟的倒计时强制锁定模式。
- [ ] **数据全量导出**：支持将本地数据一键导出为 Excel (.xlsx) 或更美观的 PDF 月度维生报告。
- [ ] **快捷键强化**：除了现有的 `Ctrl+K`，增加更多键盘操作（如快捷打卡、快捷切换面板）。


## 📄 开源协议

本项目采用 [MIT License](./LICENSE) 授权。

**🎉 特别鸣谢**
本项目是在 小红书用户 **@yuyu** 的原创设计基础上衍生开发而来，已获得原作者的修改与开源授权。感谢 **@yuyu** 提供的优秀开源！

欢迎任何形式的 Fork 与改造，愿你在星辰大海中保持专注，早日拯救地球。