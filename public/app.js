const state = {
  assets: []
};

const dictionary = {
  ETF: '可以在交易所买卖的一篮子资产，通常跟踪某个指数或行业主题。',
  成交量: '某段时间内成交了多少份额或股票，用来观察市场关注度。',
  涨跌幅: '当前价格相对上一交易日收盘价上涨或下跌的比例。',
  '市盈率 PE': '股价和每股盈利的比例，常用来观察估值高低，但不能单独决定好坏。',
  市值: '股票市场给一家公司估算的总价值，约等于股价乘以总股本。',
  基金规模: '基金管理的资产总量，规模过小可能影响流动性和稳定性。',
  '52周高点': '过去约一年里出现过的最高价格，用来观察价格离高位有多近。',
  '52周低点': '过去约一年里出现过的最低价格，用来观察价格离低位有多近。',
  均线: '把一段时间的价格平均后连成线，用来平滑观察趋势。',
  '5日均线': '最近5个交易日的平均价格，更偏短期变化。',
  '20日均线': '最近20个交易日的平均价格，更偏中短期趋势。',
  支撑位: '价格下跌时可能遇到承接的位置，只是观察参考，不是保证。',
  压力位: '价格上涨时可能遇到阻力的位置，只是观察参考，不是保证。',
  趋势: '价格在一段时间内大致向上、向下或横向震荡的方向。',
  放量: '成交量比平时明显增加，说明关注度或分歧变大。',
  缩量: '成交量比平时减少，说明交易热度下降或观望变多。',
  回调: '上涨后出现一段下跌或整理，不等于趋势一定结束。',
  突破: '价格越过之前较难越过的位置，需要结合成交量和后续表现观察。',
  风险提醒: '提醒可能影响价格的波动因素，不是买卖指令。'
};

const assetRows = document.querySelector('#assetRows');
const analysisList = document.querySelector('#analysisList');
const refreshBtn = document.querySelector('#refreshBtn');
const lastUpdate = document.querySelector('#lastUpdate');

function formatDateTime(value) {
  if (!value) return '暂无';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || value === '') return '暂无';
  const number = Number(value);
  if (!Number.isFinite(number)) return '暂无';
  return number.toLocaleString('zh-CN', { maximumFractionDigits: digits });
}

function formatPercent(value) {
  if (value === null || value === undefined || value === '') return '暂无';
  const number = Number(value);
  if (!Number.isFinite(number)) return '暂无';
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
}

function changeClass(value) {
  const number = Number(value);
  if (number > 0) return 'up';
  if (number < 0) return 'down';
  return 'flat';
}

function typeLabel(asset) {
  return asset.market === 'CN' ? '大陆ETF' : '美股股票';
}

function displayPrice(price) {
  if (!price || price.close_price === null || price.close_price === undefined) return '暂无';
  const currency = price.currency ? ` ${price.currency}` : '';
  return `${formatNumber(price.close_price)}${currency}`;
}

function displayMarketValue(asset, price) {
  if (!price?.market_cap) return '暂无';
  const label = asset.market === 'CN' ? '基金规模' : '市值';
  return `${label} ${formatNumber(price.market_cap, 0)}`;
}

function dailyJudgement(asset) {
  const price = asset.latest_price;
  const change = Number(price?.change_percent);
  if (!price || !Number.isFinite(change)) return '暂无行情，先观察数据是否成功更新。';
  if (change > 1) return '上涨较明显，可观察是否伴随放量和主题热度。';
  if (change > 0) return '小幅上涨，可观察上涨是否延续。';
  if (change < -1) return '下跌较明显，可观察是否接近支撑位。';
  if (change < 0) return '小幅下跌，可观察回调是否缩量。';
  return '接近平盘，可观察后续是否选择方向。';
}

function buildAnalysis(asset) {
  const price = asset.latest_price;
  const change = Number(price?.change_percent);
  const close = Number(price?.close_price);
  const hasClose = Number.isFinite(close) && close > 0;
  const support = hasClose ? formatNumber(close * 0.97) : '暂无';
  const resistance = hasClose ? formatNumber(close * 1.03) : '暂无';

  let trend = '暂无足够行情，先等待数据源更新。';
  if (Number.isFinite(change)) {
    if (change > 0) trend = '今日偏上涨，短线情绪较前一交易日改善。';
    if (change < 0) trend = '今日偏下跌，短线处在回调或整理中。';
    if (change === 0) trend = '今日接近平盘，趋势方向暂不明显。';
  }

  const volume = price?.volume
    ? `成交量为 ${formatNumber(price.volume, 0)}，可继续观察是否比平时明显放大或缩小。`
    : '成交量暂无，暂时无法判断放量或缩量。';

  const risk = asset.market === 'CN'
    ? 'ETF 仍会受指数、行业轮动、流动性和节假日数据缺失影响。'
    : '美股成长股通常受业绩预期、利率变化和市场风险偏好影响，波动可能较大。';

  return {
    title: `【${asset.name_cn || asset.name_en || asset.symbol} 技术分析】`,
    trend,
    volume,
    support,
    resistance,
    risk,
    beginner: '这些价格位置只用于学习观察，不代表未来一定会发生，也不是买入或卖出提示。'
  };
}

function renderTable() {
  const rows = state.assets.slice(0, 20);
  if (rows.length === 0) {
    assetRows.innerHTML = '<tr><td colspan="14" class="empty">暂无观察标的。</td></tr>';
    return;
  }

  assetRows.innerHTML = rows.map((asset, index) => {
    const price = asset.latest_price;
    const percentClass = changeClass(price?.change_percent);
    return `
      <tr>
        <td class="index-cell">${index + 1}</td>
        <td><span class="type-pill">${typeLabel(asset)}</span></td>
        <td class="symbol">${asset.symbol || '暂无'}</td>
        <td class="name-cell">${asset.name_cn || asset.name_en || '暂无'}</td>
        <td>${displayPrice(price)}</td>
        <td class="${percentClass}">${formatPercent(price?.change_percent)}</td>
        <td>${formatNumber(price?.volume, 0)}</td>
        <td>${displayMarketValue(asset, price)}</td>
        <td>${formatNumber(price?.pe_ratio)}</td>
        <td>${asset.sector || '暂无'}</td>
        <td>${formatNumber(price?.week_52_high)}</td>
        <td>${formatNumber(price?.week_52_low)}</td>
        <td class="judgement-cell">${dailyJudgement(asset)}</td>
        <td class="explain-cell">${asset.beginner_note || '暂无'}</td>
      </tr>
    `;
  }).join('');
}

function renderAnalysis() {
  const rows = state.assets.slice(0, 20);
  analysisList.innerHTML = rows.map((asset) => {
    const analysis = buildAnalysis(asset);
    return `
      <article class="analysis-item">
        <h3>${analysis.title}</h3>
        <p><strong>当前趋势：</strong>${analysis.trend}</p>
        <p><strong>成交量：</strong>${analysis.volume}</p>
        <p><strong>支撑位：</strong>${analysis.support}</p>
        <p><strong>压力位：</strong>${analysis.resistance}</p>
        <p><strong>风险提醒：</strong>${analysis.risk}</p>
        <p><strong>新手解释：</strong>${analysis.beginner}</p>
      </article>
    `;
  }).join('');
}

function renderDictionary() {
  document.querySelector('#dictionary').innerHTML = Object.entries(dictionary)
    .map(([term, explain]) => `<div><dt>${term}</dt><dd>${explain}</dd></div>`)
    .join('');
}

function renderAll(status) {
  lastUpdate.textContent = formatDateTime(status?.run_finished_at || new Date().toISOString());
  renderTable();
  renderAnalysis();
}

async function loadAssets() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = '刷新中...';

  try {
    const response = await fetch('/api/assets');
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '读取失败');
    state.assets = (payload.assets || []).slice(0, 20);
    renderAll(payload.status);
  } catch (error) {
    assetRows.innerHTML = `<tr><td colspan="14" class="empty">读取数据失败：${error.message}</td></tr>`;
    analysisList.innerHTML = '<p class="empty">暂无技术分析。</p>';
    lastUpdate.textContent = '暂无';
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = '刷新数据';
  }
}

refreshBtn.addEventListener('click', loadAssets);

renderDictionary();
loadAssets();
