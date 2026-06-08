const state = {
  assets: []
};

const assetRows = document.querySelector('#assetRows');
const analysisList = document.querySelector('#analysisList');
const refreshBtn = document.querySelector('#refreshBtn');
const lastUpdate = document.querySelector('#lastUpdate');
const dataStatus = document.querySelector('#dataStatus');
const dataSources = document.querySelector('#dataSources');
const cacheInfo = document.querySelector('#cacheInfo');
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

function displayMarketValue(asset) {
  return formatNumber(asset.marketCapOrFundSize, 0);
}

function buildAnalysis(asset) {
  const change = Number(asset.changePercent);
  const price = Number(asset.price);
  const volume = Number(asset.volume);
  const hasPrice = Number.isFinite(price) && price > 0;
  const hasChange = Number.isFinite(change);
  const hasVolume = Number.isFinite(volume) && volume > 0;
  const hasWeekRange = Number.isFinite(Number(asset.week52High)) && Number.isFinite(Number(asset.week52Low));

  if (!hasPrice || !hasChange || !hasVolume) {
    return {
      title: `【${asset.name || asset.symbol}】`,
      trend: '当前缺少实时价格或成交量，暂不生成技术判断。',
      volume: '当前缺少实时价格或成交量，暂不生成技术判断。',
      supportResistance: '当前缺少实时价格或成交量，暂不生成技术判断。',
      insufficient: asset.dataDelayNote || '当前数据不足。'
    };
  }

  let trend = '当前接近平盘，短线方向暂不明显。';
  if (change > 0) trend = '当前偏上涨，可观察后续是否延续。';
  if (change < 0) trend = '当前偏下跌，可观察后续是否企稳。';

  const volumeText = `当前成交量为 ${formatNumber(volume, 0)}，可继续观察后续是否明显放大或缩小。`;
  const supportResistance = hasWeekRange
    ? `52周区间为 ${formatNumber(asset.week52Low)} 至 ${formatNumber(asset.week52High)}，当前价格为 ${formatNumber(price)}。`
    : '当前接口未返回 52 周高低点，暂不判断支撑位 / 压力位。';

  return {
    title: `【${asset.name || asset.symbol}】`,
    trend,
    volume: volumeText,
    supportResistance,
    insufficient: '本分析仅基于当前接口字段；缺失字段显示为暂无。'
  };
}

function renderTable() {
  const rows = state.assets.slice(0, 15);
  if (rows.length === 0) {
    assetRows.innerHTML = '<tr><td colspan="14" class="empty">暂无观察标的。</td></tr>';
    return;
  }

  assetRows.innerHTML = rows.map((asset, index) => {
    const statusClass = asset.dataStatus === '接口数据' ? 'live' : 'fallback';
    const percentClass = changeClass(asset.changePercent);
    return `
      <tr>
        <td class="index-cell">${index + 1}</td>
        <td><span class="type-pill">${asset.type || '暂无'}</span></td>
        <td class="symbol">${asset.symbol || '暂无'}</td>
        <td class="name-cell">${asset.name || '暂无'}</td>
        <td>${formatNumber(asset.price)}</td>
        <td class="${percentClass}">${formatPercent(asset.changePercent)}</td>
        <td>${formatNumber(asset.volume, 0)}</td>
        <td>${displayMarketValue(asset)}</td>
        <td>${formatNumber(asset.peRatio)}</td>
        <td>${asset.sectorOrTheme || '暂无'}</td>
        <td>${formatNumber(asset.week52High)}</td>
        <td>${formatNumber(asset.week52Low)}</td>
        <td><span class="status-pill ${statusClass}">${asset.dataStatus || '暂无'}</span></td>
        <td>${formatDateTime(asset.updatedAt)}</td>
      </tr>
    `;
  }).join('');
}

function renderAnalysis() {
  const rows = state.assets.slice(0, 15);
  analysisList.innerHTML = rows.map((asset) => {
    const analysis = buildAnalysis(asset);
    return `
      <article class="analysis-item">
        <h3>${analysis.title}</h3>
        <p><strong>当前趋势：</strong>${analysis.trend}</p>
        <p><strong>成交量变化：</strong>${analysis.volume}</p>
        <p><strong>支撑位 / 压力位判断：</strong>${analysis.supportResistance}</p>
        <p><strong>数据不足说明：</strong>${analysis.insufficient}</p>
      </article>
    `;
  }).join('');
}

function renderSummary(summary) {
  dataStatus.textContent = summary?.dataStatus || '暂无';
  dataSources.textContent = summary?.dataSources || '暂无';
  cacheInfo.textContent = `${summary?.cacheLabel?.cn || '大陆 ETF 缓存：5分钟'}；${summary?.cacheLabel?.us || '美股缓存：24小时'}`;
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
    state.assets = (payload.items || []).slice(0, 15);
    renderAll(payload.summary);
  } catch (error) {
    assetRows.innerHTML = '<tr><td colspan="14" class="empty">读取数据失败，请稍后重试。</td></tr>';
    analysisList.innerHTML = '<p class="empty">暂无技术分析。</p>';
    lastUpdate.textContent = '暂无';
    dataStatus.textContent = '读取失败';
    dataSources.textContent = '暂无';
    cacheInfo.textContent = '暂无';
    delayNote.textContent = '行情接口暂不可用。';
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = '刷新数据';
  }
}

refreshBtn.addEventListener('click', () => loadAssets(true));

loadAssets();
