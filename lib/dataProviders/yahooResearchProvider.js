// 非官方研究用途数据源：Yahoo Finance 相关接口不保证稳定，不用于交易。
// V1 先保留适配器结构，后续如需启用，应增加限流、错误处理和数据字段校验。
async function fetchDailyQuote(symbol) {
  throw new Error(`Yahoo Research Provider 暂未启用：${symbol} 需要后续实现。`);
}

module.exports = { fetchDailyQuote };
