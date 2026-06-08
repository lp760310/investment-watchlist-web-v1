const fs = require('fs');
const path = require('path');
const alphaVantageProvider = require('./dataProviders/alphaVantageProvider');
const eastmoneyProvider = require('./dataProviders/eastmoneyProvider');

const cache = {
  data: null,
  fetchedAt: 0
};

function readWatchlist() {
  const filePath = path.join(__dirname, '..', 'config', 'watchlist.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8')).slice(0, 20);
}

function getCacheMs() {
  const value = Number(process.env.UPDATE_DELAY_MS || 300000);
  return Number.isFinite(value) && value > 0 ? value : 300000;
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
    beginnerNote: asset.beginner_note || '',
    observeReason: asset.observe_reason || '',
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
    return buildFallbackQuote(asset, '未配置 ALPHA_VANTAGE_API_KEY；美股行情使用本地兜底。');
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
      updatedAt: new Date().toISOString(),
      beginnerNote: asset.beginner_note || '',
      observeReason: asset.observe_reason || ''
    };
    row.fieldStatus = buildFieldStatus(row);
    return row;
  } catch (error) {
    return buildFallbackQuote(asset, `Alpha Vantage 获取失败：${error.message}`);
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
      updatedAt: new Date().toISOString(),
      beginnerNote: asset.beginner_note || '',
      observeReason: asset.observe_reason || ''
    };
    row.fieldStatus = buildFieldStatus(row);
    return row;
  } catch (error) {
    return buildFallbackQuote(asset, `东方财富公开接口获取失败：${error.message}`);
  }
}

function buildSummary(items, fetchedAt, cacheExpiresAt) {
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
    cacheExpiresAt,
    cacheMs: getCacheMs(),
    delayNote: '接口数据可能为延迟或日终数据；本地兜底仅代表观察池配置，不代表真实行情。'
  };
}

async function fetchMarketData(options = {}) {
  const now = Date.now();
  const cacheMs = getCacheMs();
  if (!options.forceRefresh && cache.data && now - cache.fetchedAt < cacheMs) {
    return {
      ...cache.data,
      cache: { hit: true, cacheMs }
    };
  }

  const watchlist = readWatchlist();
  const items = [];

  for (const asset of watchlist) {
    if (asset.market === 'US') {
      items.push(await fetchUsQuote(asset));
    } else if (asset.market === 'CN') {
      items.push(await fetchCnEtfQuote(asset));
    } else {
      items.push(buildFallbackQuote(asset, `未知市场：${asset.market}`));
    }

    // 免费接口需要轻量限速，避免一次页面刷新造成密集请求。
    await sleep(250);
  }

  const fetchedAt = new Date().toISOString();
  const result = {
    items,
    summary: buildSummary(items, fetchedAt, new Date(Date.now() + cacheMs).toISOString())
  };

  cache.data = result;
  cache.fetchedAt = Date.now();

  return {
    ...result,
    cache: { hit: false, cacheMs }
  };
}

module.exports = { fetchMarketData };
