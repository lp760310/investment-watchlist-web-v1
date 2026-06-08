const fs = require('fs');
const path = require('path');
const alphaVantageProvider = require('./dataProviders/alphaVantageProvider');
const eastmoneyProvider = require('./dataProviders/eastmoneyProvider');

const cache = {
  cn: {
    items: null,
    fetchedAt: 0
  },
  us: {
    items: null,
    fetchedAt: 0
  }
};

const SAFE_ALPHA_FALLBACK_NOTE = 'Alpha Vantage 请求失败或已达免费额度限制，当前显示本地兜底数据。';
const SAFE_ALPHA_LIMIT_NOTE = 'Alpha Vantage 免费额度有限，当前显示观察池配置数据。';

function readWatchlist() {
  const filePath = path.join(__dirname, '..', 'config', 'watchlist.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8')).slice(0, 15);
}

function getCacheMs() {
  const value = Number(process.env.UPDATE_DELAY_MS || 300000);
  return Number.isFinite(value) && value > 0 ? value : 300000;
}

function getUsMarketCacheMs() {
  const value = Number(process.env.US_MARKET_CACHE_MS || 86400000);
  return Number.isFinite(value) && value > 0 ? value : 86400000;
}

function sanitizeErrorMessage(error, fallback = '外部行情接口请求失败，当前显示本地兜底数据。') {
  const secrets = [
    process.env.ALPHA_VANTAGE_API_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.ADMIN_TOKEN
  ].filter(Boolean);

  let message = typeof error === 'string' ? error : error?.message || fallback;
  for (const secret of secrets) {
    message = message.split(secret).join('[REDACTED]');
  }

  message = message
    .replace(/apikey=[^&\s]+/gi, 'apikey=[REDACTED]')
    .replace(/api[_ -]?key[^,;。\n]*/gi, 'API key [REDACTED]')
    .replace(/key as [^,;。\n]*/gi, 'key as [REDACTED]')
    .replace(/token=[^&\s]+/gi, 'token=[REDACTED]')
    .replace(/bearer\s+[a-z0-9._-]+/gi, 'Bearer [REDACTED]');

  return message.length > 220 ? fallback : message;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getType(asset) {
  return asset.market === 'CN' ? '大陆ETF' : '美股股票';
}

function buildFallbackQuote(asset, reason) {
  return {
    symbol: asset.symbol,
    name: asset.name_cn || asset.name_en || asset.symbol,
    type: getType(asset),
    price: null,
    change: null,
    changePercent: null,
    volume: null,
    marketCapOrFundSize: null,
    peRatio: null,
    sectorOrTheme: asset.sector || null,
    week52High: null,
    week52Low: null,
    dataSource: '本地观察池配置',
    dataStatus: '本地兜底',
    dataDelayNote: asset.market === 'CN' ? '暂无实时接口；仅显示观察池配置。' : reason,
    updatedAt: null,
    fieldStatus: {
      success: ['symbol', 'name', 'type', 'sectorOrTheme'],
      missing: [
        'price',
        'change',
        'changePercent',
        'volume',
        'marketCapOrFundSize',
        'peRatio',
        'week52High',
        'week52Low'
      ]
    }
  };
}

function buildFieldStatus(row) {
  const fields = [
    'price',
    'change',
    'changePercent',
    'volume',
    'marketCapOrFundSize',
    'peRatio',
    'sectorOrTheme',
    'week52High',
    'week52Low'
  ];
  return {
    success: fields.filter((field) => row[field] !== null && row[field] !== undefined && row[field] !== ''),
    missing: fields.filter((field) => row[field] === null || row[field] === undefined || row[field] === '')
  };
}

async function fetchUsQuote(asset) {
  if (!process.env.ALPHA_VANTAGE_API_KEY) {
    return buildFallbackQuote(asset, '未配置 Alpha Vantage 行情密钥，当前显示观察池配置数据。');
  }

  try {
    const quote = await alphaVantageProvider.fetchDailyQuote(asset.provider_symbol || asset.symbol);
    const row = {
      symbol: asset.symbol,
      name: asset.name_cn || asset.name_en || asset.symbol,
      type: getType(asset),
      price: toNumber(quote.close_price),
      change: toNumber(quote.change_amount),
      changePercent: toNumber(quote.change_percent),
      volume: toNumber(quote.volume),
      marketCapOrFundSize: null,
      peRatio: null,
      sectorOrTheme: asset.sector || null,
      week52High: null,
      week52Low: null,
      dataSource: quote.source || 'Alpha Vantage',
      dataStatus: '接口数据',
      dataDelayNote: 'Alpha Vantage 免费接口可能为延迟或日终数据；市值、PE、52周高低点当前未由该报价接口返回。',
      updatedAt: new Date().toISOString()
    };
    row.fieldStatus = buildFieldStatus(row);
    return row;
  } catch (error) {
    sanitizeErrorMessage(error, SAFE_ALPHA_FALLBACK_NOTE);
    return buildFallbackQuote(asset, SAFE_ALPHA_FALLBACK_NOTE);
  }
}

async function fetchCnEtfQuote(asset) {
  try {
    const quote = await eastmoneyProvider.fetchDailyQuote(asset.provider_symbol || asset.symbol);
    const row = {
      symbol: asset.symbol,
      name: asset.name_cn || asset.name_en || asset.symbol,
      type: getType(asset),
      price: toNumber(quote.close_price),
      change: toNumber(quote.change_amount),
      changePercent: toNumber(quote.change_percent),
      volume: toNumber(quote.volume),
      marketCapOrFundSize: toNumber(quote.market_cap),
      peRatio: toNumber(quote.pe_ratio) === 0 ? null : toNumber(quote.pe_ratio),
      sectorOrTheme: asset.sector || null,
      week52High: null,
      week52Low: null,
      dataSource: quote.source || '东方财富公开行情接口',
      dataStatus: '接口数据',
      dataDelayNote: '东方财富公开网页接口可能变化或延迟；52周高低点当前未返回。',
      updatedAt: new Date().toISOString()
    };
    row.fieldStatus = buildFieldStatus(row);
    return row;
  } catch (error) {
    return buildFallbackQuote(asset, sanitizeErrorMessage(error, '东方财富公开接口请求失败，当前显示本地兜底数据。'));
  }
}

function buildSummary(items, fetchedAt, cacheInfo) {
  const interfaceCount = items.filter((item) => item.dataStatus === '接口数据').length;
  const fallbackCount = items.length - interfaceCount;
  let dataStatus = '本地兜底数据';
  if (interfaceCount === items.length && items.length > 0) dataStatus = '真实行情';
  if (interfaceCount > 0 && interfaceCount < items.length) dataStatus = '部分真实行情';

  return {
    dataStatus,
    totalCount: items.length,
    interfaceCount,
    fallbackCount,
    dataSources: Array.from(new Set(items.map((item) => item.dataSource))).join(' / '),
    updatedAt: fetchedAt,
    cacheInfo,
    cacheLabel: {
      cn: '大陆 ETF 缓存：5分钟',
      us: '美股缓存：24小时'
    },
    delayNote: `${SAFE_ALPHA_LIMIT_NOTE} 接口数据可能为延迟或日终数据；本地兜底仅代表观察池配置，不代表真实行情。`
  };
}

async function fetchCnItems(assets, options = {}) {
  const now = Date.now();
  const cnCacheMs = getCacheMs();
  if (!options.forceRefresh && cache.cn.items && now - cache.cn.fetchedAt < cnCacheMs) {
    return { items: cache.cn.items, cacheHit: true };
  }

  const items = [];
  for (const asset of assets) {
    items.push(await fetchCnEtfQuote(asset));
    await sleep(250);
  }

  cache.cn.items = items;
  cache.cn.fetchedAt = Date.now();
  return { items, cacheHit: false };
}

async function fetchUsItems(assets) {
  const now = Date.now();
  const usCacheMs = getUsMarketCacheMs();
  if (cache.us.items && now - cache.us.fetchedAt < usCacheMs) {
    return { items: cache.us.items, cacheHit: true };
  }

  const items = [];
  for (const asset of assets) {
    items.push(await fetchUsQuote(asset));
    await sleep(250);
  }

  cache.us.items = items;
  cache.us.fetchedAt = Date.now();
  return { items, cacheHit: false };
}

async function fetchMarketData(options = {}) {
  const watchlist = readWatchlist();
  const cnAssets = watchlist.filter((asset) => asset.market === 'CN');
  const usAssets = watchlist.filter((asset) => asset.market === 'US');
  const otherAssets = watchlist
    .filter((asset) => asset.market !== 'CN' && asset.market !== 'US')
    .map((asset) => buildFallbackQuote(asset, `未知市场：${asset.market}`));

  const cnResult = await fetchCnItems(cnAssets, options);
  const usResult = await fetchUsItems(usAssets);
  const bySymbol = new Map([...cnResult.items, ...usResult.items, ...otherAssets].map((item) => [item.symbol, item]));
  const items = watchlist.map((asset) => bySymbol.get(asset.symbol) || buildFallbackQuote(asset, '观察池配置暂不可用。'));

  const fetchedAt = new Date().toISOString();
  const cnCacheMs = getCacheMs();
  const usCacheMs = getUsMarketCacheMs();
  const result = {
    items,
    summary: buildSummary(items, fetchedAt, {
      cn: {
        cacheHit: cnResult.cacheHit,
        cacheMs: cnCacheMs,
        cacheExpiresAt: new Date(cache.cn.fetchedAt + cnCacheMs).toISOString()
      },
      us: {
        cacheHit: usResult.cacheHit,
        cacheMs: usCacheMs,
        cacheExpiresAt: new Date(cache.us.fetchedAt + usCacheMs).toISOString()
      }
    })
  };

  return {
    ...result,
    cache: {
      cn: { hit: cnResult.cacheHit, cacheMs: cnCacheMs },
      us: { hit: usResult.cacheHit, cacheMs: usCacheMs }
    }
  };
}

module.exports = { fetchMarketData, sanitizeErrorMessage };
