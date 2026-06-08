require('dotenv').config();

const { runDailyPriceUpdate } = require('../lib/updateDailyPrices');

async function main() {
  const startedAt = new Date();
  console.log(`开始时间：${startedAt.toISOString()}`);

  const result = await runDailyPriceUpdate();

  console.log(`结束时间：${result.finished_at}`);
  console.log(`成功数量：${result.success_count}`);
  console.log(`失败数量：${result.failed_count}`);

  const failures = result.details.filter((item) => item.status === 'failed');
  if (failures.length > 0) {
    console.log('失败原因：');
    for (const failure of failures) {
      console.log(`- ${failure.symbol}: ${failure.message}`);
    }
  }
}

main().catch((error) => {
  console.error(`每日更新主流程失败：${error.message}`);
  process.exitCode = 1;
});
