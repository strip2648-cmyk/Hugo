'use strict';
const { getJson, getText } = require('../../lib/http');
const COINS = { btc: 'bitcoin', eth: 'ethereum', sol: 'solana', ada: 'cardano', doge: 'dogecoin', bnb: 'binancecoin', xrp: 'ripple', ton: 'the-open-network', trx: 'tron', dot: 'polkadot', matic: 'matic-network', link: 'chainlink', ltc: 'litecoin', avax: 'avalanche-2', shib: 'shiba-inu', usdt: 'tether', usdc: 'usd-coin', atom: 'cosmos', near: 'near', uni: 'uniswap' };
function coinId(input) {
  const key = String(input || 'btc').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (COINS[key]) return COINS[key];
  return key.length > 2 ? key : 'bitcoin';
}
async function parseFeed(url, limit = 10) {
  const response = await getText(url, { accept: 'application/rss+xml, application/xml, text/xml, */*' });
  const items = [];
  for (const match of response.text.matchAll(/<item[\s\S]*?<\/item>/gi)) {
    const block = match[0];
    const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1] || '';
    const link = (block.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) || [])[1] || '';
    const date = (block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || '';
    items.push({ title: title.replace(/<[^>]+>/g, '').trim(), url: link.trim(), date: date.trim() });
  }
  return items.slice(0, limit);
}
const tools = {
  coin_price: { category: 'crypto', description: '\u0426\u0435\u043d\u0430 \u043d\u0430 \u043a\u0440\u0438\u043f\u0442\u043e (\u0431\u0435\u0437 \u043a\u043b\u0443\u0447)', params: { coin: 'btc|eth|sol|...' }, run: async (args) => {
    const id = coinId(args.coin);
    const data = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd,eur&include_24hr_change=true&include_last_updated_at=true`, { timeout_ms: 15000 });
    const price = data[id];
    if (!price) throw new Error(`no price for ${id}`);
    return { coin: id, usd: price.usd, eur: price.eur, change_24h_percent: price.usd_24h_change, updated_at: price.last_updated_at, source: 'coingecko' };
  } },
  top_coins: { category: 'crypto', description: '\u0422\u043e\u043f \u043a\u0440\u0438\u043f\u0442\u043e \u043f\u043e \u043a\u0430\u043f\u0438\u0442\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u0458\u0430', params: { limit: 'number', currency: 'usd|eur' }, run: async (args) => {
    const limit = Math.min(Number(args.limit) || 10, 50);
    const currency = args.currency === 'eur' ? 'eur' : 'usd';
    const data = await getJson(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&order=market_cap_desc&per_page=${limit}&page=1&price_change_percentage=24h`, { timeout_ms: 15000 });
    const rows = Array.isArray(data) ? data : [];
    return { currency, coins: rows.slice(0, limit).map((coin) => ({ rank: coin.market_cap_rank, id: coin.id, symbol: coin.symbol, price: coin.current_price, change_24h_percent: coin.price_change_percentage_24h, market_cap: coin.market_cap })) };
  } },
  coin_chart: { category: 'crypto', description: '\u0418\u0441\u0442\u043e\u0440\u0438\u0458\u0430 \u043d\u0430 \u0446\u0435\u043d\u0430', params: { coin: 'string', days: 'number' }, run: async (args) => {
    const id = coinId(args.coin);
    const days = String(Math.min(Number(args.days) || 7, 365));
    const data = await getJson(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}`, { timeout_ms: 20000 });
    const points = data.prices || [];
    const step = Math.max(1, Math.floor(points.length / 40));
    const first = points.length ? points[0][1] : null;
    const last = points.length ? points[points.length - 1][1] : null;
    return {
      coin: id, days: Number(days), from: first, to: last,
      change_percent: first ? Number((((last - first) / first) * 100).toFixed(2)) : null,
      min: points.length ? Math.min(...points.map((point) => point[1])) : null,
      max: points.length ? Math.max(...points.map((point) => point[1])) : null,
      points: points.filter((_, index) => index % step === 0).map(([time, price]) => ({ at: new Date(time).toISOString().slice(0, 16), price: Number(price.toFixed(4)) })),
    };
  } },
  trending_coins: { category: 'crypto', description: '\u0422\u0440\u0435\u043d\u0434\u0438\u043d\u0433 \u043a\u0440\u0438\u043f\u0442\u043e (24\u0447)', params: {}, run: async () => {
    const data = await getJson('https://api.coingecko.com/api/v3/search/trending', { timeout_ms: 15000 });
    return { coins: (data.coins || []).slice(0, 15).map((coin) => ({ id: coin.item.id, name: coin.item.name, symbol: coin.item.symbol, rank: coin.item.market_cap_rank })) };
  } },
  fear_greed: { category: 'crypto', description: 'Fear & Greed \u0438\u043d\u0434\u0435\u043a\u0441', params: {}, run: async () => {
    const data = await getJson('https://api.alternative.me/fng/?limit=2', { timeout_ms: 15000 });
    const list = data.data || [];
    return { value: list[0] ? Number(list[0].value) : null, label: list[0] ? list[0].value_classification : null, yesterday: list[1] ? Number(list[1].value) : null };
  } },
  gas_eth: { category: 'crypto', description: 'Bitcoin/Ethereum \u043c\u0440\u0435\u0436\u043d\u0438 \u0442\u0430\u043a\u0441\u0438 (\u0431\u0435\u0437 \u043a\u043b\u0443\u0447)', params: {}, run: async () => {
    const bitcoin = await getJson('https://mempool.space/api/v1/fees/recommended', { timeout_ms: 15000 });
    const height = Number((await getText('https://mempool.space/api/blocks/tip/height', { accept: 'text/plain' })).text.trim());
    return { bitcoin_sat_per_vb: bitcoin, bitcoin_height: height, note: 'Ethereum gas \u0431\u0430\u0440\u0430 \u043a\u043b\u0443\u0447 \u043a\u0430\u0458 \u0441\u0435\u043a\u043e\u0458 \u043f\u0440\u043e\u0432\u0430\u0458\u0434\u0435\u0440; \u0437\u0430\u0442\u043e\u0430 \u0434\u0430\u0432\u0430\u043c \u0441\u0430\u043c\u043e Bitcoin (\u0431\u0435\u0437 \u043a\u043b\u0443\u0447)' };
  } },
  defi_tvl: { category: 'crypto', description: '\u0412\u043a\u0443\u043f\u0435\u043d DeFi TVL', params: { limit: 'number' }, run: async (args) => {
    const total = await getJson('https://api.llama.fi/tvl', { timeout_ms: 15000 });
    const protocols = await getJson('https://api.llama.fi/protocols', { timeout_ms: 20000 });
    return { total_usd: total, top_protocols: (Array.isArray(protocols) ? protocols : []).slice(0, Math.min(Number(args.limit) || 10, 30)).map((protocol) => ({ name: protocol.name, tvl: protocol.tvl, chain: protocol.chain, change_7d: protocol.change_7d })) };
  } },
  btc_halving: { category: 'crypto', description: '\u0421\u043b\u0435\u0434\u0435\u043d Bitcoin halving', params: {}, run: async () => {
    const height = Number((await getText('https://mempool.space/api/blocks/tip/height', { accept: 'text/plain' })).text.trim());
    const interval = 210000;
    const next = (Math.floor(height / interval) + 1) * interval;
    const blocksLeft = next - height;
    return { height, next_halving_height: next, blocks_left: blocksLeft, estimated_days: Number(((blocksLeft * 10) / 1440).toFixed(1)), estimated_date: new Date(Date.now() + blocksLeft * 10 * 60000).toISOString().slice(0, 10) };
  } },
  crypto_news: { category: 'crypto', description: '\u041a\u0440\u0438\u043f\u0442\u043e \u0432\u0435\u0441\u0442\u0438', params: { limit: 'number' }, run: async (args) => ({ items: await parseFeed('https://cointelegraph.com/rss', Math.min(Number(args.limit) || 8, 25)) }) },
  exchange_rates: { category: 'crypto', description: '\u041a\u0443\u0440\u0441\u0435\u0432\u0438 \u0432\u0430\u043b\u0443\u0442\u0438 (\u0431\u0435\u0437 \u043a\u043b\u0443\u0447)', params: { base: 'MKD|EUR|USD' }, run: async (args) => {
    const base = String(args.base || 'EUR').toUpperCase().slice(0, 3);
    const data = await getJson(`https://open.er-api.com/v6/latest/${base}`, { timeout_ms: 15000 });
    const rates = data.rates || {};
    return { base, date: data.time_last_update_utc, rates: { MKD: rates.MKD, USD: rates.USD, EUR: rates.EUR, GBP: rates.GBP, CHF: rates.CHF, RSD: rates.RSD, BGN: rates.BGN } };
  } },
  portfolio: { category: 'crypto', description: '\u0412\u0440\u0435\u0434\u043d\u043e\u0441\u0442 \u043d\u0430 \u043f\u043e\u0440\u0442\u0444\u043e\u043b\u0438\u043e', params: { holdings: 'array' }, run: async (args) => {
    const holdings = Array.isArray(args.holdings) ? args.holdings : [];
    if (!holdings.length) throw new Error('holdings array is required, e.g. [{coin:"btc", amount:0.5}]');
    const ids = holdings.map((holding) => coinId(holding.coin)).join(',');
    const data = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd,eur`, { timeout_ms: 15000 });
    const rows = holdings.map((holding) => {
      const id = coinId(holding.coin);
      const price = data[id] || {};
      const amount = Number(holding.amount) || 0;
      return { coin: id, amount, price_usd: price.usd, value_usd: price.usd ? Number((price.usd * amount).toFixed(2)) : null, value_eur: price.eur ? Number((price.eur * amount).toFixed(2)) : null };
    });
    return { rows, total_usd: Number(rows.reduce((total, row) => total + (row.value_usd || 0), 0).toFixed(2)) };
  } },
};
module.exports = { tools, parseFeed, coinId, COINS };
