# HM-CLSS

风格化的个人维生与科研自我管理系统。

> “你现在的首要任务，就是活下去，然后拯救地球。”

**HM-CLSS（Hail Mary Crew Life Support System）** 以《挽救计划》为灵感，用值班、任务、速记和统计把日常状态收进同一个工作区。项目采用原生 HTML、CSS 和 JavaScript，没有构建步骤或后端服务；数据默认保存在浏览器，也可通过 GitHub Gist 在设备间同步。

## 核心能力

- **维生值班**：记录早、中、晚班的连线与登出，支持补录、全天或分时离舰。
- **科研与专注**：管理任务计时和归档，记录手机干扰阻断并解锁成就。
- **捕捉与复盘**：用 `Ctrl+K` 快速记录 Markdown 速记，通过归档、图表和月度导出复盘。
- **情绪与同步**：生成深空酒馆情绪特调，并可选择使用 GitHub Gist 同步工作区。

统计口径：标记为 `excused` 的签到或登出记录仍保留在统计分母中，并与合规记录一样计入合规率。

## 快速开始

在仓库根目录启动静态服务：

```bash
python3 -m http.server 8000
```

然后访问 [http://localhost:8000](http://localhost:8000)。

## 数据、导出与同步

HM-CLSS 的工作区保存在当前站点的浏览器 `localStorage`。更换浏览器、域名或端口会进入不同的存储空间；清理站点数据也会删除本地记录。重要数据请定期在 **深空通讯设置 → 本地数据导出** 中下载 **全量工作区 JSON**，并在云端覆盖、备份恢复或手动迁移前再导出一次。

月度导出还提供结构化 JSON、复盘 Markdown 和 CSV。导出文件不包含 GitHub Token 或 Gist ID。

GitHub Gist 同步是可选功能：

1. 创建只授予 `gist` 权限的 GitHub Personal Access Token。
2. 创建 Secret Gist，文件名使用 `workspace_data.json`，初始内容填写 `{}`。
3. 在 **深空通讯设置** 中填写 Token 和 Gist ID。新建且确认为空的 Gist 可先执行“上传覆盖云端”；接入已有 Gist 或换设备时，先备份当前本地数据，再执行“拉取云端数据”，避免覆盖 Gist 中的原有记录。

Token 只保存在当前标签页的 `sessionStorage`，关闭后需要重新填写；Gist ID 会保存在 `localStorage`。Secret Gist 不公开列出，但链接和凭据仍应视为敏感信息。不要把真实 Token、Gist ID、本地导出或包含个人记录的截图提交到仓库。

数据兼容、云端覆盖和恢复原则见 [docs/data-compatibility.md](./docs/data-compatibility.md)，同步或本地数据异常见 [docs/troubleshooting.md](./docs/troubleshooting.md)。

## 开发与验证

`index.html` 是页面入口；业务代码按 `runtime / workspace / ui / features` 放在 `assets/js/`，样式位于 `assets/css/`，固定版本的浏览器依赖位于 `assets/vendor/`。新增脚本时同步维护 [`script-order.txt`](./scripts/smoke_manifest/script-order.txt)；vendor 来源和版本见 [`assets/vendor/README.md`](./assets/vendor/README.md)。

提交前运行主回归：

```bash
bash scripts/smoke-check.sh
```

涉及 UI、导航、存储、同步、导出、可访问性或布局时，再运行真实浏览器 smoke：

```bash
bash scripts/setup-browser-test.sh
bash scripts/browser-smoke.sh
```

Windows PowerShell 入口：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-check.ps1
powershell -ExecutionPolicy Bypass -File scripts/browser-smoke.ps1
```

浏览器失败产物写入 `.artifacts/browser-smoke/`。完整测试要求、Chromium 用法和人工巡检分别见 [CONTRIBUTING.md](./CONTRIBUTING.md)、[docs/testing-artifacts.md](./docs/testing-artifacts.md) 与 [docs/functional-self-check.md](./docs/functional-self-check.md)。

## 文档导航

| 主题 | 文档 |
| --- | --- |
| 安全边界与敏感数据 | [SECURITY.md](./SECURITY.md) |
| 开发、提交和 Pull Request | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| 版本变更 | [CHANGELOG.md](./CHANGELOG.md) |
| 发布检查与验证证据 | [docs/release-checklist.md](./docs/release-checklist.md) · [docs/release-validation.md](./docs/release-validation.md) |
| 浏览器支持 | [docs/browser-support.md](./docs/browser-support.md) |
| 数据兼容与恢复 | [docs/data-compatibility.md](./docs/data-compatibility.md) |
| 故障排查 | [docs/troubleshooting.md](./docs/troubleshooting.md) |
| 第三方依赖复核 | [docs/vendor-review.md](./docs/vendor-review.md) |
| 工程成熟度审计 | [docs/commercial-readiness-audit.md](./docs/commercial-readiness-audit.md) |
| 架构决策 | [零构建静态应用](./docs/adr/0001-zero-build-static-app.md) · [脚本顺序契约](./docs/adr/0002-script-order-startup-contract.md) · [本地存储与同步安全](./docs/adr/0003-local-storage-sync-safety.md) |

## 贡献与许可

欢迎 Fork、改造或提交 Pull Request。请遵循 [CONTRIBUTING.md](./CONTRIBUTING.md) 的代码与验证要求，并避免在提交、截图或测试产物中包含个人数据和同步凭据。

项目采用 [MIT License](./LICENSE) 授权。项目在小红书用户 **@yuyu** 的原创设计基础上衍生开发，并已获得原作者的修改与开源授权。
