# IdentityGen 旧版本迁移指南

本文档用于从没有后台版本更新功能的旧版本迁移到新版。

## 迁移到 v1.1.0

v1.1.0 新增后台“系统版本”功能，支持在后台检查 GitHub 远端版本并执行更新。

### 新增内容

- 后台新增“系统版本”卡片，显示当前版本、最新版本、分支和远端仓库。
- 新增 `VERSION` 文件，用于显示语义化版本号。
- 服务端新增版本接口：
  - `POST /api?action=version`
  - `POST /api?action=checkversion`
  - `POST /api?action=updateversion`
- 修复后台保存空网站标题/页脚无效的问题。
- 地图服务切换新增独立保存入口。

### 从旧版本首次升级

旧版本后台没有“检查版本/更新版本”入口，因此第一次需要在服务器命令行手动升级。

```bash
cd /www/wwwroot/identitygen
git status
git pull --ff-only origin main
```

如果使用 PM2 运行，升级后重启服务：

```bash
pm2 restart identitygen
```

如果直接运行 `node server.js`，请停止旧进程后重新启动：

```bash
node server.js 3002
```

升级完成后访问后台：

```text
https://你的域名/admin.html
```

登录后在“系统版本”区域点击“检查版本”。从 v1.1.0 开始，后续小版本可以在后台点击“更新版本”。

### 保留后台配置

后台配置保存在运行时文件 `config.json` 中，默认已经被 `.gitignore` 忽略。升级前请确认它没有被 Git 管理：

```bash
git status --short config.json
```

如果显示 `config.json` 被跟踪，请执行：

```bash
git rm --cached config.json
git commit -m "fix: stop tracking runtime config"
```

不要删除服务器上的 `config.json`，否则后台密码、Google Maps API Key、网站标题和页脚配置会丢失。

### 自动更新的限制

后台“更新版本”只执行安全的快进更新：

```bash
git pull --ff-only
```

以下情况会拒绝自动更新，需要手动处理：

- 服务器代码有未提交修改。
- 本地分支有自定义提交。
- 本地分支和远端分支已经分叉。
- 服务器目录不是 Git 仓库。
- 服务器无法访问 GitHub。

处理完 Git 状态后，再回到后台点击“检查版本”和“更新版本”。

### 发布版本规范

新版本发布时需要同步推送 `main` 分支和版本 tag：

```bash
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin main
git push origin v1.1.0
```

后台显示的版本号来自仓库根目录的 `VERSION` 文件。发布新版本时，请先更新 `VERSION` 文件，再提交和打 tag。
