require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createSupabaseClient } = require('../lib/supabaseClient');

async function main() {
  const filePath = path.join(__dirname, '..', 'config', 'watchlist.json');
  const watchlist = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const supabase = createSupabaseClient();

  const rows = watchlist.map((item) => ({
    ...item,
    is_active: true
  }));

  const { error } = await supabase
    .from('watchlist_assets')
    .upsert(rows, { onConflict: 'symbol,market' });

  if (error) throw new Error(`导入观察池失败：${error.message}`);
  console.log(`已导入或更新 ${rows.length} 个观察对象。`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
