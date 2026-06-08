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
const dataStatus = document.querySelector('#dataStatus');
const dataSources = document.querySelector('#dataSources');
const delayNote = document.querySelector('#delayNote');

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
  return asset.type || '暂无';
}

function displayPrice(asset) {
  return formatNumber(asset.price);
}

function displayMarketValue(asset) {
  return formatNumber(asset.marketCapOrFundSize, 0);
}

function formatFieldStatus(asset) {
  const success = asset.fieldStatus?.success?.length ? asset.fieldStatus.success.join('、') : '无';
  const missing = asset.fieldStatus?.missing?.length ? asset.fieldStatus.missing.join('、') : '无';
  return `已获取：${success}；暂无：${missing}`;
}

function dailyJudgement(asset) {
  const change = Number(asset.changePercent);
  if (!Number.isFinite(change)) return '暂无涨跌幅，先观察数据源是否成功返回。';
  if (change > 1) return '上涨较明显，可观察是否伴随放量和主题热度。';
  if (change > 0) return '小幅上涨，可观察上涨是否延续。';
  if (change < -1) return '下跌较明显，可观察是否接近支撑位。';
  if (change < 0) return '小幅下跌，可观察回调是否缩量。';
  return '接近平盘，可观察后续是否选择方向。';
}

function buildAnalysis(asset) {
  const change = Number(asset.changePercent);
  const close = Number(asset.price);
  const hasClose = Number.isFinite(close) && close > 0;
  const support = hasClose ? formatNumber(close * 0.97) : '暂无';
  const resistance = hasClose ? formatNumber(close * 1.03) : '暂无';

  let trend = '暂无足够行情，先等待数据源更新。';
  if (Number.isFinite(change)) {
    if (change > 0) trend = '今日偏上涨，短线情绪较前一交易日改善。';
    if (change < 0) trend = '今日偏下跌，短线处在回调或整理中。';
    if (change === 0) trend = '今日接近平盘，趋势方向暂不明显。';
  }

  const volume = asset.volume
    ? `成交量为 ${formatNumber(asset.volume, 0)}，可继续观察是否比平时明显放大或缩小。`
    : '成交量暂无，暂时无法判断放量或缩量。';

  const missing52Week = asset.week52High === null || asset.week52High === undefined || asset.week52Low === null || asset.week52Low === undefined
    ? '由于当前接口未返回 52 周高低点，暂不判断突破/回撤位置。'
    : `52周区间为 ${formatNumber(asset.week52Low)} 到 ${formatNumber(asset.week52High)}，可观察价格处在区间的哪个位置。`;

  const risk = asset.type === '大陆ETF'
    ? 'ETF 仍会受指数、行业轮动、流动性和节假日数据缺失影响。'
    : '美股成长股通常受业绩预期、利率变化和市场风险偏好影响，波动可能较大。';

  return {
    title: `【${asset.name || asset.symbol} 技术分析】`,
    trend,
    volume,
    support,
    resistance,
    risk: `${missing52Week}${risk}`,
    beginner: `${asset.dataDelayNote || '数据状态暂无说明。'} 这些价格位置只用于学习观察，不代表未来一定会发生，也不是买入或卖出提示。`
  };
}

function renderTable() {
  const rows = state.assets.slice(0, 20);
  if (rows.length === 0) {
    assetRows.innerHTML = '<tr><td colspan="16" class="empty">暂无观察标的。</td></tr>';
    return;
  }

  assetRows.innerHTML = rows.map((asset, index) => {
    const percentClass = changeClass(asset.changePercent);
    const statusClass = asset.dataStatus === '接口数据' ? 'live' : 'fallback';
    return `
      <tr>
        <td class="index-cell">${index + 1}</td>
        <td><span class="type-pill">${typeLabel(asset)}</span></td>
        <td class="symbol">${asset.symbol || '暂无'}</td>
        <td class="name-cell">${asset.name || '暂无'}</td>
        <td><span class="status-pill ${statusClass}">${asset.dataStatus || '暂无'}</span></td>
        <td>${displayPrice(asset)}</td>
        <td class="${percentClass}">${formatPercent(asset.changePercent)}</td>
        <td>${formatNumber(asset.volume, 0)}</td>
        <td>${displayMarketValue(asset)}</td>
        <td>${formatNumber(asset.peRatio)}</td>
        <td>${asset.sectorOrTheme || '暂无'}</td>
        <td>${formatNumber(asset.week52High)}</td>
        <td>${formatNumber(asset.week52Low)}</td>
        <td class="judgement-cell">${dailyJudgement(asset)}</td>
        <td class="explain-cell">${asset.beginnerNote || asset.dataDelayNote || '暂无'}</td>
        <td class="field-cell">${formatFieldStatus(asset)}</td>
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

function renderSummary(summary) {
  dataStatus.textContent = summary?.dataStatus || '暂无';
  dataSources.textContent = summary?.dataSources || '暂无';
  delayNote.textContent = summary?.delayNote || '暂无';
  lastUpdate.textContent = formatDateTime(summary?.updatedAt || new Date().toISOString());
}

function renderAll(summary) {
  renderSummary(summary);
  renderTable();
  renderAnalysis();
}

async function loadAssets(forceRefresh = false) {
  refreshBtn.disabled = true;
  refreshBtn.textContent = '刷新中...';

  try {
    const url = forceRefresh ? '/api/market-data?refresh=1' : '/api/market-data';
    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '读取失败');
    state.assets = (payload.items || []).slice(0, 20);
    renderAll(payload.summary);
  } catch (error) {
    assetRows.innerHTML = `<tr><td colspan="16" class="empty">读取数据失败：${error.message}</td></tr>`;
    analysisList.innerHTML = '<p class="empty">暂无技术分析。</p>';
    lastUpdate.textContent = '暂无';
    dataStatus.textContent = '读取失败';
    dataSources.textContent = '暂无';
    delayNote.textContent = error.message;
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = '刷新数据';
  }
}

refreshBtn.addEventListener('click', () => loadAssets(true));

renderDictionary();
loadAssets();
