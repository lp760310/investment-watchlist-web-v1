# 部署环境变量说明

Render Web Service 可先不配置 Supabase 环境变量，页面会使用 `config/watchlist.json` 显示 15 个观察标的，并把暂时抓不到的行情字段显示为“暂无”。

V2.3 的 `/api/market-data` 行情接口会优先尝试真实行情接口，并使用分市场内存缓存。接口失败、限流或字段缺失时，逐项回退到本地观察池配置。页面会显示数据来源、更新时间、行情状态和缓存设置。

| 变量名 | 是否必填 | 用途 |
| --- | --- | --- |
| `ALPHA_VANTAGE_API_KEY` | 可选，真实美股行情增强项 | Alpha Vantage 免费额度有限，当前 5 只美股默认每日最多刷新一次。不配置或额度受限时，美股显示本地兜底。 |
| `US_MARKET_CACHE_MS` | 可选 | 美股行情缓存时间，默认 `86400000` 毫秒，也就是 24 小时。 |
| `UPDATE_DELAY_MS` | 可选 | 大陆 ETF 行情缓存时间，默认 `300000` 毫秒，也就是 5 分钟。 |
| `SUPABASE_URL` | 可选，启用数据库时需要 | Supabase 项目 URL。当前页面可以不依赖 Supabase 先运行。 |
| `SUPABASE_SERVICE_ROLE_KEY` | 可选，启用数据库时需要 | Supabase 服务端密钥。不要提交到 GitHub。 |
| `ADMIN_TOKEN` | 可选，启用手动更新接口时建议配置 | 保护 `/api/manual-update`。 |
| `PORT` | Render 自动提供 | 服务监听端口，本地默认 3000。 |

安全说明：

- 不要把 API Key、token 或 secret 写入 GitHub、页面、日志或接口返回。
- Alpha Vantage 原始错误文本不会返回给前端；失败时只显示安全兜底文案。
- 如果追求更稳定的美股行情，后续应考虑更合适的数据源或付费接口。
