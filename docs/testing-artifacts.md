# Testing Artifacts

本仓库把本地和 CI 运行产生的浏览器测试工件统一收纳到 `.artifacts/browser-smoke/`，并默认忽略整个目录。

目录约定：

- `failures/`
  浏览器冒烟失败时留下的截图、页面源码、控制台日志和错误摘要。
- `visual/`
  视觉基线场景生成的关键页截图，以及当前布局快照 `layout-current.json`。

约束：

- 这些工件只用于本地排障和 CI 下载，不进入版本库。
- `scripts/browser-smoke.sh` 与 GitHub Actions 共享同一套工件目录约定。
- 如果修改工件路径，需要同步更新 `HM_CLSS_BROWSER_ARTIFACT_DIR`、CI 上传路径和本文档。
