# 仓库指南

## 项目结构与模块组织
这个仓库是一个无需构建步骤的静态前端应用。主要实现位于 `index.html` 中，其中包含页面结构、Tailwind 配置、自定义 CSS，以及所有原生 JavaScript 行为。项目文档位于 `README.md`，许可证文件位于 `LICENSE`。

由于当前大部分逻辑仍集中在一个文件中，请按功能区域组织相关修改：UI 标记应放在对应的页面区域附近，共享常量如 `CONFIG`、`tagMap` 和 `achievementList` 应放在脚本头部附近，功能逻辑应放在命名清晰的函数中，例如 `initTaskManagement()` 或 `updateStatisticsCharts()`。

## 构建、测试与开发命令
目前项目还没有包管理器或正式的构建流水线。

- `python3 -m http.server 8000`
  在 `http://localhost:8000` 启动本地静态服务器，用于浏览器测试。
- `open index.html` 或将 `index.html` 直接拖入浏览器
  这是快速进行简单界面冒烟测试的最快方式。
- `rg "keyword" index.html`
  在编辑前优先用它来定位常量、页面区块和事件处理逻辑。

## 编码风格与命名规范
遵循 `index.html` 中已有的风格：使用 4 个空格缩进、分号，以及具有描述性的 camelCase 函数名，例如 `updateTodayStatus`。只有真正的常量才使用 `UPPER_SNAKE_CASE`，例如 `MAX_MOOD_CHARS`。所有面向用户的文案都要与项目现有的中文科幻主题保持一致。

保持当前技术栈不变：HTML、Tailwind 工具类和原生 JavaScript。新增行为时，优先扩展现有的初始化与渲染/更新模式，而不是引入框架或大规模抽象。

## 测试指南
当前仓库还没有自动化测试套件。请在浏览器中手动验证修改，重点关注以下内容：

- 面板之间的导航切换
- 本地持久化与刷新后的表现
- 受本次修改影响的任务、打卡和图表流程
- 窄屏设备上的响应式布局

如果你修复了一个 bug，请在 PR 描述中附上可复现的手动验证步骤。

## 提交与 Pull Request 规范
最近的提交历史使用简洁的 Conventional Commit 前缀，例如 `feat:` 和 `fix:`。请保持这一格式，例如：`fix: correct leave record filtering`。

Pull Request 应包含简短摘要、用户可见影响、手动测试步骤，以及界面改动对应的截图或录屏。如有关联 issue，请一并链接。不要将无关的重构与功能或 bug 修复混在同一个 PR 中。

## 安全与配置提示
应用支持通过 GitHub Gist 同步。不要把个人令牌、Gist ID 或导出的私密数据提交到仓库中，也不要出现在截图里。
