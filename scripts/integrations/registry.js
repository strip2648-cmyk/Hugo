'use strict';
const { readJsonSync, writeJsonSync } = require('../lib/fsx');
const { InputError } = require('../lib/errors');
const config = require('../lib/config').load();
const KEYLESS = [
  { id: 'coingecko', category: 'crypto', endpoint: 'https://api.coingecko.com/api/v3', healthPath: '/ping', keyless: true, usedBy: ['coin_price', 'top_coins', 'coin_chart'] },
  { id: 'open-meteo', category: 'weather', endpoint: 'https://api.open-meteo.com', healthPath: '/v1/forecast?latitude=41.99&longitude=21.43&current=temperature_2m', keyless: true, usedBy: ['current_weather', 'weather_7day'] },
  { id: 'wikipedia', category: 'knowledge', endpoint: 'https://en.wikipedia.org', healthPath: '/api/rest_v1/page/summary/Artificial_intelligence', keyless: true, usedBy: ['wikipedia', 'company_search'] },
  { id: 'github', category: 'code', endpoint: 'https://api.github.com', healthPath: '/rate_limit', keyless: true, usedBy: ['learn_from_repo'] },
  { id: 'dns-google', category: 'web', endpoint: 'https://dns.google', healthPath: '/resolve?name=example.com&type=A', keyless: true, usedBy: ['dns_lookup'] },
  { id: 'rdap', category: 'web', endpoint: 'https://rdap.org', healthPath: '/domain/example.com', keyless: true, usedBy: ['whois_lookup'] },
  { id: 'hackernews', category: 'news', endpoint: 'https://hacker-news.firebaseio.com/v0', healthPath: '/topstories.json', keyless: true, usedBy: ['hackernews'] },
  { id: 'languagetool', category: 'text', endpoint: 'https://api.languagetool.org/v2', healthPath: '/languages', keyless: true, usedBy: ['spell_check'] },
  { id: 'itunes', category: 'media', endpoint: 'https://itunes.apple.com', healthPath: '/search?term=hugo&limit=1', keyless: true, usedBy: ['podcast_search', 'movie_search'] },
  { id: 'mempool', category: 'crypto', endpoint: 'https://mempool.space/api', healthPath: '/blocks/tip/height', keyless: true, usedBy: ['gas_eth', 'btc_halving'] },
  { id: 'defillama', category: 'crypto', endpoint: 'https://api.llama.fi', healthPath: '/tvl', keyless: true, usedBy: ['defi_tvl'] },
  { id: 'yahoo-finance', category: 'business', endpoint: 'https://query1.finance.yahoo.com', healthPath: '/v8/finance/chart/AAPL?range=1d&interval=1d', keyless: true, usedBy: ['stock_quote'] },
  { id: 'exchangerate', category: 'business', endpoint: 'https://open.er-api.com/v6', healthPath: '/latest/EUR', keyless: true, usedBy: ['currency_exchange', 'exchange_rates'] },
];
function load() { const data = readJsonSync(config.file.adapters, { adapters: [] }); return Array.isArray(data) ? { adapters: data } : data; }
function save(data) { return writeJsonSync(config.file.adapters, data); }
function list(category) {
  const custom = load().adapters || [];
  const all = [...KEYLESS, ...custom];
  return category ? all.filter((adapter) => adapter.category === category) : all;
}
function add(adapter) {
  if (!adapter || !adapter.id || !adapter.endpoint) throw new InputError('adapter needs id and endpoint');
  const data = load();
  data.adapters = (data.adapters || []).filter((entry) => entry.id !== adapter.id).concat({ keyless: true, ...adapter });
  save(data);
  return adapter;
}
function resolve(id) { return list().find((adapter) => adapter.id === id) || null; }
function summary() {
  const adapters = list();
  const byCategory = {};
  for (const adapter of adapters) byCategory[adapter.category] = (byCategory[adapter.category] || 0) + 1;
  return { total: adapters.length, keys_required: adapters.filter((adapter) => !adapter.keyless).length, by_category: byCategory, adapters };
}
function actions() {
  return [
    { name: 'integrations_list', category: 'integrations', description: '\u041b\u0438\u0441\u0442\u0430 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u0438', params: { category: 'string' }, handler: async (input) => list(input.category) },
    { name: 'integrations_summary', category: 'integrations', description: '\u0421\u043e\u0436\u0435\u0442\u043e\u043a \u043d\u0430 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u0438\u0442\u0435', params: {}, handler: async () => summary() },
    { name: 'integrations_add', category: 'integrations', description: '\u0414\u043e\u0434\u0430\u0458 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u0458\u0430', params: { id: 'string', endpoint: 'string' }, handler: async (input) => add(input) },
  ];
}
module.exports = { list, add, resolve, summary, actions, KEYLESS, load };
