const { createSupabaseClient } = require('./supabaseClient');
const alphaVantageProvider = require('./dataProviders/alphaVantageProvider');
const eastmoneyProvider = require('./dataProviders/eastmoneyProvider');
const yahooResearchProvider = require('./dataProviders/yahooResearchProvider');

const providers = {
  alpha_vantage: alphaVantageProvider,
  eastmoney: eastmoneyProvider,
  yahoo_research: yahooResearchProvider
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTradeDate() {
  return new Date().toISOString().slice(0, 10);
}

async function runDailyPriceUpdate(options = {}) {
  const supabase = options.supabase || createSupabaseClient();
  const runStartedAt = new Date();
  const details = [];
  let successCount = 0;
  let failedCount = 0;

  const { data: assets, error: assetError } = await supabase
    .from('watchlist_assets')
    .select('*')
    .eq('is_active', true)
    .order('market', { ascending: true })
    .order('symbol', { ascending: true });

  if (assetError) {
    throw new Error(`读取观察池失败：${assetError.message}`);
  }

  for (const asset of assets || []) {
    const provider = providers[asset.data_provider];
    if (!provider) {
      failedCount += 1;
      details.push({ symbol: asset.symbol, status: 'failed', message: `未知数据源：${asset.data_provider}` });
      continue;
    }

    try {
      const quote = await provider.fetchDailyQuote(asset.provider_symbol || asset.symbol);
      const row = {
        asset_id: asset.id,
        trade_date: getTradeDate(),
        close_price: quote.close_price,
        previous_close: quote.previous_close,
        change_amount: quote.change_amount,
        change_percent: quote.change_percent,
        volume: quote.volume,
        market_cap: quote.market_cap,
        pe_ratio: quote.pe_ratio,
        currency: quote.currency,
        source: quote.source,
        raw_json: quote.raw_json
      };

      const { error: upsertError } = await supabase
        .from('daily_prices')
        .upsert(row, { onConflict: 'asset_id,trade_date' });

      if (upsertError) throw new Error(`写入 daily_prices 失败：${upsertError.message}`);

      successCount += 1;
      details.push({ symbol: asset.symbol, status: 'success', source: quote.source });
    } catch (error) {
      failedCount += 1;
      details.push({ symbol: asset.symbol, status: 'failed', message: error.message });
    }

    await sleep(Number(process.env.UPDATE_DELAY_MS || 12000));
  }

  const runFinishedAt = new Date();
  const status = failedCount === 0 ? 'success' : successCount > 0 ? 'partial_success' : 'failed';
  const message = `成功 ${successCount} 个，失败 ${failedCount} 个。`;

  await supabase.from('update_logs').insert({
    run_started_at: runStartedAt.toISOString(),
    run_finished_at: runFinishedAt.toISOString(),
    status,
    success_count: successCount,
    failed_count: failedCount,
    message,
    details
  });

  return {
    started_at: runStartedAt.toISOString(),
    finished_at: runFinishedAt.toISOString(),
    status,
    success_count: successCount,
    failed_count: failedCount,
    details
  };
}

module.exports = { runDailyPriceUpdate };
