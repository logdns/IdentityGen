# IdentityGen — 随机身份信息生成器

> 🌐 一键生成真实格式的美国（US）和英国（UK）个人身份信息，支持地图定位、一键复制、中英双语切换。

[![GitHub](https://img.shields.io/badge/GitHub-logdns%2FIdentityGen-181717?style=flat&logo=github)](https://github.com/logdns/IdentityGen)
![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)

---

## 📋 目录

- [功能特性](#-功能特性)
- [在线演示](#-在线演示)
- [技术栈](#-技术栈)
- [项目结构](#-项目结构)
- [快速开始](#-快速开始)
- [配置说明](#-配置说明)
- [部署指南](#-部署指南)
  - [通用部署](#通用部署)
  - [Nginx 部署](#nginx-部署)
  - [宝塔面板部署](#宝塔面板部署)
- [API 说明](#-api-说明)
- [常见问题](#-常见问题)
- [许可证](#-许可证)

---

## ✨ 功能特性

- 🇺🇸 **美国身份生成** — 真实州/城市、SSN、电话号码、邮编
- 🇬🇧 **英国身份生成** — 真实地区/城市、NI Number、邮编  
- 🗺️ **地图定位** — 基于 Google Maps 嵌入显示真实地理位置
- 📋 **一键复制** — 单项复制或批量复制全部信息
- 🌐 **中英双语** — 界面支持中文/英文实时切换
- ☀️🌙 **日夜主题** — 亮色/暗色主题自由切换，偏好自动保存
- 📱 **响应式设计** — 完美适配手机、平板和桌面设备
- 🔐 **后台管理** — 密码保护的管理面板，可配置地图服务、API Key、网站品牌
- 🎨 **高级 UI** — Glassmorphism 设计、粒子动画背景、微交互动效
- 🔄 **真实地址** — 通过 OpenStreetMap Nominatim API 获取真实地址数据
- 👤 **真实姓名** — 通过 FakerAPI 获取真实格式的姓名和个人信息

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端结构 | HTML5 |
| 样式 | CSS3（CSS Variables、Glassmorphism） |
| 逻辑 | 原生 JavaScript（ES2017+） |
| 字体 | Google Fonts（Inter、JetBrains Mono） |
| 后端配置 | Node.js（零依赖轻量服务器，读写 JSON 配置文件） |
| 地址数据 | [OpenStreetMap Nominatim API](https://nominatim.openstreetmap.org/) |
| 身份数据 | [FakerAPI](https://fakerapi.it/) |
| 地图展示 | Google Maps Embed |

> ⚡ **轻量级架构**：零依赖 Node.js 服务器，无需数据库。配置存储在服务端 `config.json` 文件中，后台修改后所有客户端即时生效。主题偏好存储在浏览器 `localStorage` 中。

---

## 📁 项目结构

```
identitygen/
├── index.html        # 主页面 — 身份信息生成器前端
├── admin.html        # 后台管理面板 — 密码保护
├── server.js         # Node.js 服务器 — 静态文件服务 + 配置 API（零依赖）
├── config.json       # 配置文件 — 存储密码、API Key、网站设置等
├── style.css         # 全局样式 — 亮色/暗色主题
├── app.js            # 主逻辑 — 生成、i18n、地图、粒子动画
├── data.js           # 静态数据 — 美国/英国州、城市、街道、姓名等
└── README.md         # 项目文档（本文件）
```

---

## 🚀 快速开始

### 方式 1：克隆仓库 + 启动服务器

```bash
git clone https://github.com/logdns/IdentityGen.git
cd IdentityGen
node server.js
# 打开 http://localhost:3000
```

### 方式 2：指定端口启动

```bash
# 方式 A：命令行参数
node server.js 8080

# 方式 B：环境变量
PORT=8080 node server.js

# 然后打开 http://localhost:8080
```

> 💡 **前提条件**：仅需安装 [Node.js](https://nodejs.org/)（v14+）。无需 `npm install`，零第三方依赖。

---

## ⚙️ 配置说明

所有配置通过**后台管理面板**进行，访问 `admin.html` 或点击前台右上角 ⚙️ 按钮进入。

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 管理密码 | 后台登录密码 | `admin` |
| 地图服务商 | 基础嵌入模式 / Google Maps API | 基础嵌入模式 |
| Google Maps API Key | 使用 Google Maps Embed API 时需要 | 无（使用基础嵌入）|
| 网站标题 | 自定义 Logo 文字 | `IdentityGen` |
| 页脚文字 | 自定义页脚内容（支持 HTML） | `© 2026 IdentityGen` |

### 获取 Google Maps API Key

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 **Maps Embed API**
4. 在"凭据"页面创建 API Key
5. 将 API Key 填入后台设置

---

## 📦 部署指南

### 通用部署

IdentityGen 仅需 Node.js 环境，无需安装任何依赖：

```bash
# 1. 上传所有项目文件到服务器
# 2. 启动服务器
node server.js 3000

# 或使用 PM2 持久化运行（推荐生产环境）
npm install -g pm2
pm2 start server.js --name identitygen -- 3000
pm2 save
pm2 startup
```

需要的文件：
```
server.js         ← Node.js 服务器（静态文件 + 配置 API）
index.html
admin.html
config.json       ← 配置文件（自动创建）
style.css
app.js
data.js
```

> 💡 如果不需要后台管理功能，也可以直接手动编辑 `config.json` 文件。

---

### Nginx 反向代理部署（推荐生产环境）

#### 1. 上传文件并启动 Node.js 服务

```bash
# 创建网站目录
sudo mkdir -p /www/wwwroot/identitygen

# 上传项目文件
scp -r ./* user@your-server:/www/wwwroot/identitygen/

# 使用 PM2 持久化运行
cd /www/wwwroot/identitygen
npm install -g pm2
pm2 start server.js --name identitygen -- 3000
pm2 save
pm2 startup
```

#### 2. 配置 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";

    # 反向代理到 Node.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }
}
```

#### 3. 重启 Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### 4. 配置 SSL（推荐）

```bash
# 使用 Certbot 自动配置 Let's Encrypt SSL
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

### 宝塔面板部署

#### 前提条件

- 已安装宝塔面板（[宝塔官网](https://www.bt.cn/)）
- 已安装 Nginx
- 已安装 Node.js（宝塔「软件商店」→ 搜索 `PM2管理器` 安装）
- 已有域名并解析到服务器 IP（可选，也可使用 IP 直接访问）

#### 步骤 1：创建网站

1. 登录宝塔面板 → 左侧菜单点击 **「网站」**
2. 点击 **「添加站点」**
3. 填写配置：
   - **域名**：填写你的域名（如 `id.example.com`）；如果没有域名，填写 `服务器IP:端口`
   - **根目录**：默认即可（如 `/www/wwwroot/id.example.com`）
   - **FTP**：不创建
   - **数据库**：不创建（无需数据库）
   - **PHP 版本**：选择 `纯静态`（后端由 Node.js 提供）
4. 点击 **「提交」** 创建网站

#### 步骤 2：上传项目文件

**方式 A：通过宝塔面板文件管理器上传**

1. 左侧菜单点击 **「文件」**
2. 导航到网站根目录（如 `/www/wwwroot/id.example.com`）
3. **删除** 默认文件（`index.html`、`404.html` 等）
4. 点击 **「上传」** 按钮
5. 选择以下文件上传：
   ```
   server.js
   config.json
   index.html
   admin.html
   style.css
   app.js
   data.js
   ```
6. 等待上传完成

**方式 B：通过 SSH/SFTP 上传**

```bash
# 使用 scp 命令
scp server.js config.json index.html admin.html style.css app.js data.js root@你的服务器IP:/www/wwwroot/id.example.com/

# 或使用 FileZilla 等 SFTP 工具连接上传
```

**方式 C：通过远程下载（如果代码在 Git 仓库）**

1. 在宝塔面板的 **「终端」** 中执行：
   ```bash
   cd /www/wwwroot/id.example.com
   rm -f index.html 404.html  # 清理默认文件
   git clone https://github.com/logdns/IdentityGen.git .
   ```

#### 步骤 3：配置 SSL 证书（推荐）

1. 点击网站列表中对应站点 → **「SSL」**
2. 选择 **「Let's Encrypt」**
3. 勾选你的域名
4. 点击 **「申请」**
5. 勾选 **「强制 HTTPS」**

#### 步骤 4：启动 Node.js 服务

1. 在宝塔面板中打开 **「PM2管理器」**（软件商店安装）
2. 点击 **「添加项目」**
3. 填写配置：
   - **启动文件**：`/www/wwwroot/id.example.com/server.js`
   - **项目名称**：`identitygen`
   - **运行目录**：`/www/wwwroot/id.example.com`
   - **端口**：`3000`
4. 点击 **「确定」** 启动项目

或者通过 SSH 终端启动：
```bash
cd /www/wwwroot/id.example.com
pm2 start server.js --name identitygen -- 3000
pm2 save
```

#### 步骤 5：配置 Nginx 反向代理

1. 点击网站列表中对应站点 → **「设置」** → **「配置文件」**
2. 在 `server { }` 块中添加反向代理配置：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

3. 保存配置文件

#### 步骤 6：验证部署

1. 打开浏览器访问你的域名或 IP：`https://id.example.com`
2. 确认前台页面正常加载
3. 点击右上角 ⚙️ 按钮或访问 `https://id.example.com/admin.html`
4. 使用默认密码 `admin` 登录后台
5. **⚠️ 重要：立即修改默认密码！**

#### 常见宝塔部署问题

| 问题 | 解决方案 |
|------|----------|
| 页面显示 404 | 检查 Node.js 服务是否正在运行，Nginx 反向代理是否配置正确 |
| 样式/脚本未加载 | 检查 `style.css`、`app.js`、`data.js` 是否在同一目录 |
| SSL 证书申请失败 | 确认域名已正确解析到服务器 IP，检查 80 端口是否开放 |
| 后台无法登录 | 默认密码为 `admin`，确认 Node.js 服务正在运行 |
| 后台保存失败 | 检查 `config.json` 文件权限，确保 Node.js 进程有写入权限 |
| 地图不显示 | 检查是否可以正常访问 Google Maps；如需 API Key，在后台设置中配置 |
| Node.js 服务挂掉 | 使用 PM2 管理进程：`pm2 restart identitygen` |

---

## 🔗 API 说明

本项目使用以下第三方 API（均为免费公开服务）：

### FakerAPI
- **用途**：生成随机姓名、邮箱和个人信息
- **接口地址**：`https://fakerapi.it/api/v2/persons`
- **认证**：无需（免费公开）
- **限制**：有速率限制，超出后自动回退到本地数据生成
- **文档**：[https://fakerapi.it/en](https://fakerapi.it/en)

### OpenStreetMap Nominatim
- **用途**：反向地理编码，获取真实地址数据
- **接口地址**：`https://nominatim.openstreetmap.org/reverse`
- **认证**：无需（免费公开）
- **限制**：最大 1 请求/秒
- **文档**：[https://nominatim.org/release-docs/latest/](https://nominatim.org/release-docs/latest/)

### Google Maps Embed
- **用途**：地图显示
- **模式 1**：基础嵌入模式（无需 API Key）
- **模式 2**：Google Maps Embed API（需要 API Key，效果更好）

> 📌 如果 API 不可用，系统会自动回退到本地随机数据生成，保证功能可用。

---

## ❓ 常见问题

### Q: 这个项目需要后端吗？
**A:** 需要 Node.js 环境。项目自带一个零依赖的 `server.js`，同时提供静态文件服务和配置管理 API。只需 `node server.js` 一条命令即可启动，无需 `npm install`。如无 Node.js 环境，也可直接手动编辑 `config.json` 文件配置。

### Q: 数据存储在哪里？
**A:** 后台配置（密码、API Key、地图服务商、网站标题、页脚）存储在服务端的 `config.json` 文件中，管理员在后台修改后所有用户立即生效。主题偏好（亮色/暗色）作为用户个人设置仍存储在浏览器 `localStorage` 中。

### Q: 默认管理密码是什么？
**A:** 默认密码为 `admin`，首次登录后请立即修改。

### Q: 为什么有时候地址数据加载较慢？
**A:** Nominatim API 有速率限制（1 请求/秒）。系统会最多尝试 10 次获取有效地址。如果所有尝试都失败，将使用本地随机数据。

### Q: 如何完全离线使用？
**A:** 可以直接使用，但当 API 不可用时将自动回退到本地数据。地图功能需要网络连接。

### Q: 支持哪些浏览器？
**A:** 支持所有现代浏览器（Chrome 60+、Firefox 55+、Safari 11+、Edge 79+）。

---

## 📄 许可证

本项目仅供学习和测试使用。

生成的身份信息为虚假数据，请勿用于任何违法用途。

---

<p align="center">
  ⚡ <strong>IdentityGen</strong> — Made with ❤️<br>
  <a href="https://github.com/logdns/IdentityGen">github.com/logdns/IdentityGen</a>
</p>
