# IdentityGen 旧版本迁移指南

本文档用于从没有后台版本更新功能的旧版本迁移到新版。

## 迁移到 v1.2.0

v1.2.0 新增前台广告位、加密币捐赠地址、多语言选择，并加强后台配置 API 的安全边界。

### 新增内容

- 前台预留三个广告位：顶部、信息区下方、地图下方。
- 后台新增“广告位管理”，可启用广告位并填写有限 HTML。
- 前台底部可显示加密币捐赠地址，后台最多配置 8 条，支持复制。
- 前台默认语言为英文，右上角可切换英文、简体中文、繁体中文、日文。
- 后台新增“前台语言”设置，可配置首次访问的默认语言。
- 后台版本更新成功后会自动刷新当前页面。
- 配置 API 改用登录会话 token，保留旧密码参数兼容。
- 服务端限制请求体大小，禁止直接访问 `config.json`、`.git` 等隐藏或内部文件。
- 广告位和页脚 HTML 会过滤脚本、事件属性和不安全链接。

### 从旧版升级

Git 部署可直接更新：

```bash
cd /www/wwwroot/identitygen
git pull --ff-only origin main
pm2 restart identitygen
```

如果是文件上传部署，请确保同时上传这些文件：

```text
server.js
VERSION
index.html
admin.html
style.css
app.js
data.js
config.example.json
```

不要上传覆盖生产环境里的 `config.json`。旧版 `config.json` 可以继续使用，服务端会自动补齐 `default_language`、`ads`、`donation` 等新字段。

升级完成后进入后台：

```text
https://你的域名/admin.html
```

登录后可在“前台语言”“广告位管理”“加密币捐赠”“系统版本”区域完成配置。后续 Git 部署的小版本，可在后台点击“检查版本”和“更新版本”。

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

### 后台提示无法读取 Git 版本信息

如果后台“系统版本”提示无法读取 Git 版本信息，通常说明当前部署目录不是 Git 仓库，或 Node.js 进程无法读取 `.git` 目录。请在服务器网站目录检查：

```bash
cd /www/wwwroot/identitygen
git rev-parse --is-inside-work-tree
```

正常应输出：

```text
true
```

如果命令报错，说明这是文件上传部署，不支持后台自动更新。建议改为 Git 部署：

```bash
cd /www/wwwroot
mv identitygen identitygen.bak
git clone https://github.com/logdns/IdentityGen.git identitygen
cp identitygen.bak/config.json identitygen/config.json
cd identitygen
node server.js 3002
```

如果使用 PM2，请重新启动：

```bash
pm2 restart identitygen
```

从 `v1.1.1` 开始，即使不是 Git 部署，后台也会显示本地 `VERSION` 版本号，并会尝试读取 GitHub 上的最新 `VERSION`。但“更新版本”仍然需要 Git 仓库，文件上传部署只能按上面的步骤手动升级。

### 后台提示本地代码有未提交修改

后台更新前会检查 Git 工作区，避免覆盖服务器上的本地改动。常见原因是手动编辑过代码文件，或只改了 `VERSION` 文件导致当前版本号和 Git 提交不一致。

先查看具体改动：

```bash
cd /www/wwwroot/identitygen
git status --short
```

如果只看到：

```text
 M VERSION
```

说明只是版本号文件被本地改动，可以恢复后再更新：

```bash
git restore -- VERSION
git pull --ff-only origin main
pm2 restart identitygen
```

从 `v1.1.3` 开始，后台更新会先自动 `git stash push --include-untracked` 暂存本地未提交改动，再执行 `git pull --ff-only`。如果更新失败，系统会尝试 `git stash pop` 恢复本地改动。更新成功后，本地改动会留在 stash 中，必要时可手动查看：

```bash
git stash list
git stash show -p stash@{0}
```

### 发布版本规范

新版本发布时需要同步推送 `main` 分支和版本 tag：

```bash
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin main
git push origin v1.1.0
```

后台显示的版本号来自仓库根目录的 `VERSION` 文件。发布新版本时，请先更新 `VERSION` 文件，再提交和打 tag。
