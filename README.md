# 投资观察学习系统 V1

这是一个本地可运行、后续可部署到 Render 的投资观察网页。它用于长期观察学习 10 支大陆 ETF 和 10 支美股中小市值成长股，保存基础行情数据到 Supabase，并在网页上展示价格变化、观察理由、新手解释和每日复盘。

重要：本项目只用于学习观察，不构成投资建议；数据可能延迟、缺失或错误；不用于自动交易。

## 1. 本地运行步骤

先安装依赖：

```bash
npm install
```

复制环境变量模板：

```bash
cp .env.example .env
```

填好 `.env` 后启动：

```bash
npm start
```

浏览器打开：

```text
http://localhost:3000
```

开发模式可使用：

```bash
npm run dev
```

## 2. 创建 Supabase 项目

1. 打开 Supabase 官网，新建一个项目。
2. 进入 Project Settings，找到 API。
3. 复制 `Project URL` 到 `.env` 的 `SUPABASE_URL`。
4. 复制 `service_role` key 到 `.env` 的 `SUPABASE_SERVICE_ROLE_KEY`。

service role key 权限很高，只能放在后端环境变量中，不要写进前端页面，不要提交到公开仓库。

## 3. 初始化数据库

进入 Supabase 项目的 SQL Editor，复制 `scripts/init-db.sql` 的全部内容并执行。

它会创建：

- `watchlist_assets`：观察池资产
- `daily_prices`：每日行情
- `update_logs`：更新日志
- `daily_notes`：每日笔记，V1 页面暂时优先用 localStorage

## 4. 配置 .env

`.env` 示例：

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ALPHA_VANTAGE_API_KEY=your-alpha-vantage-api-key
ADMIN_TOKEN=change-this-manual-update-token
PORT=3000
```

`ADMIN_TOKEN` 用于保护手动更新接口。调用 `/api/manual-update` 时必须在 header 中带上 `x-admin-token`。

## 5. 导入观察池

确认数据库已初始化，并且 `.env` 已填写 Supabase 信息，然后运行：

```bash
npm run seed
```

观察池配置在 `config/watchlist.json`，后续可以直接编辑这个文件，再重新运行导入命令。

## 6. 手动更新一次

命令行更新：

```bash
npm run update:prices
```

接口触发更新：

```bash
curl -X POST http://localhost:3000/api/manual-update \
  -H "x-admin-token: your-admin-token"
```

单只资产更新失败不会影响其他资产继续更新，失败原因会写入 `update_logs`。

## 7. 部署到 Render

项目包含 `render.yaml`，可用于 Render Blueprint：

1. 把项目推送到 GitHub / GitLab。
2. 在 Render 创建 Blueprint，选择包含本项目的仓库。
3. 按提示填写环境变量：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`ALPHA_VANTAGE_API_KEY`、`ADMIN_TOKEN`。
4. 部署 Web Service 后访问 Render 分配的网址。

Render Cron Job 已在 `render.yaml` 中配置为每天 UTC 00:30 运行一次：

```yaml
schedule: "30 0 * * *"
```

UTC 00:30 大约对应北京时间 08:30。Render Cron 使用 UTC 时间；节假日或非交易日如果没有新数据，允许显示“无新数据”或数据暂不可用。

## 8. Render Cron Job 是什么

Cron Job 是 Render 上独立运行的定时任务。它不会一直占用 Web Service，而是在设定时间启动，执行 `npm run update:prices`，完成后退出。

## 9. 免费数据源限制

已实现或预留的数据源：

- `alpha_vantage`：美股日线报价，读取 `ALPHA_VANTAGE_API_KEY`。免费 API 有频率限制，V1 已加入简单延迟。
- `eastmoney`：大陆 ETF 公开网页接口。公开接口可能变化，抓取失败时不会编造数据。
- `yahoo_research`：非官方研究用途备用数据源，V1 只保留 stub，占位提示后续实现。

价格、市值、PE 等字段可能为空。页面会显示“暂无”或“数据暂不可用”。

## 10. 当前功能

- 首页状态卡片
- 观察池表格
- 类型、涨跌、数据异常筛选
- 代码、中文名、英文名搜索
- 每日复盘，本地 localStorage 保存
- 浏览器打印 / 导出 PDF
- 新手词典
- Supabase 数据库存储
- Render Web Service 和 Cron Job 配置

## 11. API

- `GET /api/health`：服务健康状态
- `GET /api/assets`：观察池和每个资产最新价格
- `GET /api/assets/:symbol/history`：最近 30 天价格
- `GET /api/update-logs`：最近 20 次更新日志
- `POST /api/manual-update`：手动触发更新，需要 `x-admin-token`

## 12. 免责声明

本项目只用于学习观察，不构成投资建议。任何数据都可能延迟、缺失或错误。不要根据本项目页面直接做买入、卖出或自动交易决策。V1 不接入登录系统、不做 AI 分析、不做交易建议、不做自动交易。
