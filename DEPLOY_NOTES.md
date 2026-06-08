# 部署环境变量说明

Render Web Service 可先不配置 Supabase 环境变量，页面会使用 `config/watchlist.json` 显示 20 个观察标的，并把暂时抓不到的行情字段显示为“暂无”。

如需启用数据库、每日更新脚本和手动更新接口，请在 Render 的 Environment 中添加以下变量。不要把真实密钥写入代码或提交到 GitHub。

| 变量名 | 是否必填 | 用途 |
| --- | --- | --- |
| `SUPABASE_URL` | 可选，启用数据库时需要 | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 可选，启用数据库时需要 | Supabase 服务端密钥 |
| `ALPHA_VANTAGE_API_KEY` | 可选，启用美股行情更新时需要 | Alpha Vantage 免费 API Key |
| `ADMIN_TOKEN` | 可选，启用手动更新接口时建议配置 | 保护 `/api/manual-update` |
| `UPDATE_DELAY_MS` | 可选 | 每只标的更新间隔，默认 12000 毫秒 |
| `PORT` | Render 自动提供 | 服务监听端口，本地默认 3000 |

当前项目未使用 `DASHSCOPE_API_KEY`。
