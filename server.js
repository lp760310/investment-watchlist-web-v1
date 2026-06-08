require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const { createSupabaseClient } = require('./lib/supabaseClient');
const { runDailyPriceUpdate } = require('./lib/updateDailyPrices');
const { fetchMarketData, sanitizeErrorMessage } = require('./lib/marketData');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getSupabaseOrFail(res) {
  try {
    return createSupabaseClient();
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error, '服务配置暂不可用。') });
    return null;
  }
}

function readWatchlistFallback() {
  const filePath = path.join(__dirname, 'config', 'watchlist.json');
  const watchlist = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return watchlist.map((asset, index) => ({
    id: `config-${index + 1}`,
    ...asset,
    is_active: true,
    latest_price: null,
    trend_5d: { label: '暂无', direction: 'flat' },
    trend_20d: { label: '暂无', direction: 'flat' }
  }));
}

function sendFallbackAssets(res, message) {
  res.json({
    assets: readWatchlistFallback(),
    status: {
      run_finished_at: null,
      status: 'config_fallback',
      success_count: 0,
      failed_count: 0,
      message
    }
  });
}

app.get('/api/health', async (req, res) => {
  res.json({
    ok: true,
    name: '投资观察池学习表 V2.4',
    time: new Date().toISOString()
  });
});

app.get('/api/assets', async (req, res) => {
  let supabase;
  try {
    supabase = createSupabaseClient();
  } catch (error) {
    sendFallbackAssets(res, sanitizeErrorMessage(error, '数据库配置暂不可用，已显示本地观察池配置。'));
    return;
  }

  const { data: assets, error: assetError } = await supabase
    .from('watchlist_assets')
    .select('*')
    .eq('is_active', true)
    .order('market', { ascending: true })
    .order('symbol', { ascending: true });

  if (assetError) {
    sendFallbackAssets(res, `读取 Supabase 观察池失败：${assetError.message}`);
    return;
  }

  if (!assets || assets.length === 0) {
    sendFallbackAssets(res, 'Supabase 暂无观察池数据，已显示本地配置观察池。');
    return;
  }

  const assetIds = assets.map((asset) => asset.id);
  let prices = [];
  if (assetIds.length > 0) {
    const { data, error: priceError } = await supabase
      .from('daily_prices')
      .select('*')
      .in('asset_id', assetIds)
      .order('trade_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (priceError) {
      sendFallbackAssets(res, `读取 Supabase 行情失败：${priceError.message}`);
      return;
    }
    prices = data || [];
  }

  const groupedPrices = new Map();
  for (const price of prices) {
    if (!groupedPrices.has(price.asset_id)) groupedPrices.set(price.asset_id, []);
    groupedPrices.get(price.asset_id).push(price);
  }

  const rows = assets.map((asset) => {
    const history = groupedPrices.get(asset.id) || [];
    return {
      ...asset,
      latest_price: history[0] || null,
      trend_5d: buildTrend(history.slice(0, 5)),
      trend_20d: buildTrend(history.slice(0, 20))
    };
  });

  const { data: logs } = await supabase
    .from('update_logs')
    .select('*')
    .order('run_started_at', { ascending: false })
    .limit(1);

  res.json({
    assets: rows,
    status: logs?.[0] || null
  });
});

app.get('/api/market-data', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const marketData = await fetchMarketData({ forceRefresh });
    res.json(marketData);
  } catch (error) {
    res.status(500).json({
      error: sanitizeErrorMessage(error, '读取行情数据失败，当前请稍后重试。')
    });
  }
});

app.get('/api/assets/:symbol/history', async (req, res) => {
  const supabase = getSupabaseOrFail(res);
  if (!supabase) return;

  const symbol = req.params.symbol.toUpperCase();
  const { data: asset, error: assetError } = await supabase
    .from('watchlist_assets')
    .select('id, symbol, name_cn, name_en')
    .eq('symbol', symbol)
    .single();

  if (assetError) {
    res.status(404).json({ error: `未找到 ${symbol}` });
    return;
  }

  const { data, error } = await supabase
    .from('daily_prices')
    .select('*')
    .eq('asset_id', asset.id)
    .order('trade_date', { ascending: false })
    .limit(30);

  if (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error, '读取历史行情失败。') });
    return;
  }

  res.json({ asset, history: data || [] });
});

app.get('/api/update-logs', async (req, res) => {
  const supabase = getSupabaseOrFail(res);
  if (!supabase) return;

  const { data, error } = await supabase
    .from('update_logs')
    .select('*')
    .order('run_started_at', { ascending: false })
    .limit(20);

  if (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error, '读取更新日志失败。') });
    return;
  }

  res.json({ logs: data || [] });
});

app.post('/api/manual-update', async (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || req.header('x-admin-token') !== adminToken) {
    res.status(401).json({ error: '没有权限触发手动更新。' });
    return;
  }

  try {
    const result = await runDailyPriceUpdate();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: sanitizeErrorMessage(error, '手动更新失败。') });
  }
});

function buildTrend(history) {
  const valid = history
    .filter((item) => item.close_price !== null && item.close_price !== undefined)
    .reverse();

  if (valid.length < 2) return { label: '暂无', direction: 'flat' };

  const first = Number(valid[0].close_price);
  const last = Number(valid[valid.length - 1].close_price);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) {
    return { label: '暂无', direction: 'flat' };
  }

  const percent = ((last - first) / first) * 100;
  return {
    label: `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`,
    direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat'
  };
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`投资观察池学习表 V2.4 已启动：http://localhost:${PORT}`);
});
