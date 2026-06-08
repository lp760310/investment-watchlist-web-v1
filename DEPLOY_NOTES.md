# 部署环境变量说明

Render Web Service 可先不配置 Supabase 环境变量，页面会使用 `config/watchlist.json` 显示 20 个观察标的，并把暂时抓不到的行情字段显示为“暂无”。

V2.1 新增 `/api/market-data` 行情接口：后端会优先尝试真实行情接口，并使用 5 分钟内存缓存；接口失败、限流或字段缺失时，逐项回退到本地观察池配置。页面会显示数据来源、更新时间、行情状态和字段成功/缺失情况。

如需启用数据库、每日更新脚本和手动更新接口，请在 Render 的 Environment 中添加以下变量。不要把真实密钥写入代码或提交到 GitHub。

| 变量名 | 是否必填 | 用途 |
| --- | --- | --- |
| `ALPHA_VANTAGE_API_KEY` | 可选，真实行情增强项 | 用于美股 Alpha Vantage 行情。免费接口可能为延迟或日终数据，且有频率限制。未配置时美股显示本地兜底。 |
| `UPDATE_DELAY_MS` | 可选 | V2.1 中用于 `/api/market-data` 内存缓存时间，默认 `300000` 毫秒，也就是 5 分钟。 |
| `SUPABASE_URL` | 可选，启用数据库时需要 | Supabase 项目 URL。当前页面可以不依赖 Supabase 先运行。 |
| `SUPABASE_SERVICE_ROLE_KEY` | 可选，启用数据库时需要 | Supabase 服务端密钥。不要提交到 GitHub。 |
| `ADMIN_TOKEN` | 可选，启用手动更新接口时建议配置 | 保护 `/api/manual-update`。 |
| `PORT` | Render 自动提供 | 服务监听端口，本地默认 3000 |

当前项目未使用 `DASHSCOPE_API_KEY`。

大陆 ETF 当前会尝试东方财富公开网页接口。该接口可能变化、延迟或失败；失败时页面会标注“本地兜底”，不会伪装为实时行情。
