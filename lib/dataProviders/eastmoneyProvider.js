const SEARCH_URL = 'https://searchapi.eastmoney.com/api/suggest/get';
const QUOTE_URL = 'https://push2.eastmoney.com/api/qt/stock/get';

function parseNumber(value, scale = 1) {
  if (value === undefined || value === null || value === '-' || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / scale : null;
}

function getMarketPrefix(symbol) {
  if (symbol.startsWith('5')) return `1.${symbol}`;
  if (symbol.startsWith('1')) return `0.${symbol}`;
  return symbol;
}

async function resolveEastmoneyCode(symbol) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('input', symbol);
  url.searchParams.set('type', '14');
  url.searchParams.set('token', 'D41D8CD98F00B204E9800998ECF8427E');

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return getMarketPrefix(symbol);
    const raw = await response.json();
    const match = raw?.QuotationCodeTable?.Data?.find((item) => item.Code === symbol);
    return match?.QuoteID || getMarketPrefix(symbol);
  } catch {
    return getMarketPrefix(symbol);
  }
}

async function fetchDailyQuote(symbol) {
  // 东方财富公开网页接口可能变化，需要后续维护。这里只用于学习观察，不用于交易。
  const secid = await resolveEastmoneyCode(symbol);
  const url = new URL(QUOTE_URL);
  url.searchParams.set('secid', secid);
  url.searchParams.set('fields', 'f43,f44,f45,f46,f47,f57,f58,f60,f116,f162,f168,f169,f170');

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (error) {
    throw new Error(`东方财富网络请求失败：${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`东方财富 HTTP 错误：${response.status}`);
  }

  const raw = await response.json();
  const data = raw?.data;
  if (!data) {
    throw new Error(`东方财富未返回 ${symbol} 的有效行情，可能是节假日、非交易时段或接口变化。`);
  }

  const closePrice = parseNumber(data.f43, 100);
  const previousClose = parseNumber(data.f60, 100);
  const changeAmount = parseNumber(data.f169, 100);
  const changePercent = parseNumber(data.f170, 100);

  if (closePrice === null) {
    throw new Error(`东方财富 ${symbol} 当前价格暂不可用。`);
  }

  return {
    symbol,
    close_price: closePrice,
    previous_close: previousClose,
    change_amount: changeAmount,
    change_percent: changePercent,
    volume: parseNumber(data.f47),
    market_cap: parseNumber(data.f116),
    pe_ratio: parseNumber(data.f162, 100),
    currency: 'CNY',
    source: 'Eastmoney public quote API',
    raw_json: raw
  };
}

module.exports = { fetchDailyQuote };
