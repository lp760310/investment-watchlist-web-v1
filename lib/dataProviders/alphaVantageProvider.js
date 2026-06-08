const BASE_URL = 'https://www.alphavantage.co/query';

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchDailyQuote(symbol) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error('Alpha Vantage 未配置 ALPHA_VANTAGE_API_KEY。');
  }

  const url = new URL(BASE_URL);
  url.searchParams.set('function', 'GLOBAL_QUOTE');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('apikey', apiKey);

  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`Alpha Vantage 网络请求失败：${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`Alpha Vantage HTTP 错误：${response.status}`);
  }

  const raw = await response.json();
  if (raw.Note || raw.Information) {
    throw new Error(`Alpha Vantage 免费 API 可能超限：${raw.Note || raw.Information}`);
  }

  const quote = raw['Global Quote'];
  if (!quote || Object.keys(quote).length === 0) {
    throw new Error(`Alpha Vantage 未返回 ${symbol} 的有效行情。`);
  }

  const closePrice = parseNumber(quote['05. price']);
  const previousClose = parseNumber(quote['08. previous close']);
  const changeAmount = parseNumber(quote['09. change']);
  const changePercent = parseNumber(String(quote['10. change percent'] || '').replace('%', ''));

  return {
    symbol,
    close_price: closePrice,
    previous_close: previousClose,
    change_amount: changeAmount,
    change_percent: changePercent,
    volume: parseNumber(quote['06. volume']),
    market_cap: null,
    pe_ratio: null,
    currency: 'USD',
    source: 'Alpha Vantage GLOBAL_QUOTE',
    raw_json: raw
  };
}

module.exports = { fetchDailyQuote };
