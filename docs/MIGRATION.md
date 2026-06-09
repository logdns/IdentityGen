# IdentityGen 旧版本迁移指南

本文档用于从没有后台版本更新功能的旧版本迁移到新版。

## 旧数据迁移总览

IdentityGen 的后台数据都保存在服务器运行时文件 `config.json` 中。迁移旧版本时，核心原则是：**更新代码，不覆盖生产 `config.json`**。

旧版 `config.json` 可以直接被新版读取。新版 `server.js` 会在读取配置时自动补齐缺失字段，并在后台保存配置时写回完整结构。也就是说，从旧版升级到新版通常不需要手动改 JSON，只需要保留原来的 `config.json`。

### 升级前备份

在服务器网站目录执行：

```bash
cd /www/wwwroot/identitygen
cp config.json config.backup.$(date +%Y%m%d-%H%M%S).json
git status --short config.json
```

如果 `git status` 没有输出，说明 `config.json` 没被 Git 跟踪，可以继续升级。

如果看到类似下面的输出：

```text
 M config.json
```

或：

```text
A  config.json
```

说明运行时配置被 Git 跟踪或即将提交。请先停止跟踪，但不要删除服务器上的文件：

```bash
git rm --cached config.json
printf "\nconfig.json\nconfig.backup.*.json\n" >> .gitignore
git add .gitignore
git commit -m "fix: stop tracking runtime config"
```

### 旧字段到新字段

新版会保留旧字段，并自动补齐新增字段：

| 旧版字段 | 新版处理方式 |
|----------|--------------|
| `password` | 保留，继续作为后台密码 |
| `map_provider` | 保留，只允许 `osm` 或 `google` |
| `google_maps_key` | 保留，并限制长度 |
| `site_title` | 保留，并限制长度 |
| `site_footer` | 保留，但会过滤脚本、事件属性和危险链接 |
| `default_language` | 旧版没有时自动补 `en` |
| `ads` | 旧版没有时自动补三个关闭的广告位 |
| `donation` | 旧版没有时自动补关闭的捐赠配置 |

新版默认补齐结构如下：

```json
{
  "default_language": "en",
  "ads": {
    "top": { "enabled": false, "html": "" },
    "inline": { "enabled": false, "html": "" },
    "footer": { "enabled": false, "html": "" }
  },
  "donation": {
    "enabled": false,
    "title": "",
    "note": "",
    "items": []
  }
}
```

### 手动合并旧数据

如果你是“文件上传部署”，需要从旧目录复制数据到新目录：

```bash
cd /www/wwwroot
cp identitygen/config.json identitygen-new/config.json
```

如果新目录已经自动生成了一个新的 `config.json`，先备份再覆盖：

```bash
cd /www/wwwroot/identitygen-new
cp config.json config.fresh.json
cp ../identitygen/config.json ./config.json
```

不要把 `config.example.json` 改名后覆盖生产 `config.json`。`config.example.json` 只是模板，会包含默认密码 `admin`，覆盖后会丢失你的后台密码、API Key、广告位和捐赠地址。

### 升级后验证

升级并重启服务后检查公开配置：

```bash
curl -sS https://你的域名/api
```

正常返回里应该包含这些字段：

```json
{
  "status": "ok",
  "data": {
    "default_language": "en",
    "ads": {
      "top": { "enabled": false, "html": "" },
      "inline": { "enabled": false, "html": "" },
      "footer": { "enabled": false, "html": "" }
    },
    "donation": {
      "enabled": false,
      "title": "",
      "note": "",
      "items": []
    }
  }
}
```

再进入后台检查：

```text
https://你的域名/admin.html
```

需要确认：

- 原后台密码可以登录。
- 地图服务商和 Google Maps API Key 没丢。
- 网站标题和页脚还在。
- “前台语言”默认是 English，或是你后台设置的语言。
- “广告位管理”和“加密币捐赠”能正常保存。
- “系统在线更新”能显示当前版本和远端版本。

### 浏览器旧缓存处理

从 `v1.2.1` 开始，`app.js` 和 `style.css` 已带版本参数并返回 `no-cache`。如果前台仍显示旧中文界面或后台仍是旧更新面板，先重启服务：

```bash
pm2 restart identitygen
```

然后强制刷新浏览器：

```text
Ctrl + F5 / Cmd + Shift + R
```

如仍异常，可以在浏览器控制台清除旧语言偏好：

```js
localStorage.removeItem('idgen_lang');
localStorage.removeItem('idgen_lang_explicit');
location.reload();
```

## 迁移到 v1.2.1

v1.2.1 是针对 v1.2.0 的兼容修复版本，重点解决前台默认语言和后台在线更新认证问题。

### 修复内容

- 前台默认语言不再被旧浏览器缓存中的 `idgen_lang` 自动覆盖；只有用户主动切换语言后才会记住个人语言偏好。
- 前端资源加入版本参数，服务端对 `app.js` 和 `style.css` 返回 `no-cache`，避免更新后浏览器继续加载旧脚本。
- 后台所有需要认证的接口同时发送会话 token 和兼容密码字段，兼容旧 `api.php` 或旧 Node 进程。
- 后台“系统版本”调整为在线更新面板，显示当前版本、远端版本、状态、分支、远端仓库、差异和更新日志。
- 当前原生前后台 UI 调整为 HeroUI 风格，但仍保持零依赖部署。真正使用 HeroUI React 组件需要后续迁移到 React/Tailwind 构建链。

### 升级后建议

如果后台更新后仍显示旧界面，请重启 Node/PM2 进程并强制刷新浏览器：

```bash
pm2 restart identitygen
```

浏览器端可使用：

```text
Ctrl + F5 / Cmd + Shift + R
```

## 迁移到 v1.2.3

v1.2.3 修复部分部署环境中后台保存广告 `<script>` 后代码被旧后端过滤、输入框回填为空、前台广告不显示的问题。

### 变更内容

- 后台广告位保存时会把广告 HTML/JS 转成兼容存储格式，避免旧过滤逻辑清掉 `<script>`。
- 后台编辑广告位时会自动还原显示原始广告代码。
- 前台广告位会自动解码广告代码，并在 sandbox iframe 中隔离运行。
- 前台广告 iframe 增加 `allow-same-origin`，兼容更多第三方广告脚本。

### 升级后操作

升级到 v1.2.3 后，请在后台重新保存一次广告位配置。Git/PM2 部署升级后还需要重启 Node.js 进程，确保服务端代码也更新：

```bash
pm2 restart identitygen
```

## 迁移到 v1.2.0

v1.2.0 新增前台广告位、加密币捐赠地址、多语言选择，并加强后台配置 API 的安全边界。

### 新增内容

- 前台预留三个广告位：顶部、信息区下方、地图下方。
- 后台新增“广告位管理”，可启用广告位并填写广告 HTML/JS 代码。
- 前台底部可显示加密币捐赠地址，后台最多配置 8 条，支持复制。
- 前台默认语言为英文，右上角可切换英文、简体中文、繁体中文、日文。
- 后台新增“前台语言”设置，可配置首次访问的默认语言。
- 后台版本更新成功后会自动刷新当前页面。
- 配置 API 改用登录会话 token，保留旧密码参数兼容。
- 服务端限制请求体大小，禁止直接访问 `config.json`、`.git` 等隐藏或内部文件。
- 广告位代码会兼容保存，并在前台 sandbox iframe 中隔离运行；页脚 HTML 仍会过滤脚本、事件属性和不安全链接。

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
