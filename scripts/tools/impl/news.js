'use strict';
const config = require('../../lib/config').load();
const { getJson } = require('../../lib/http');
const { parseFeed } = require('./crypto');
async function firstWorking(urls, limit) {
  const errors = [];
  for (const url of urls) {
    try { const items = await parseFeed(url, limit); if (items.length) return { url, items }; }
    catch (error) { errors.push(`${url}: ${error.message}`); }
  }
  throw new Error(`no working feed. tried: ${errors.join(' | ')}`);
}
const tools = {
  hackernews: { category: 'news', description: 'Hacker News \u0442\u043e\u043f \u0432\u0435\u0441\u0442\u0438', params: { limit: 'number' }, run: async (args) => {
    const limit = Math.min(Number(args.limit) || 10, 30);
    const ids = await getJson('https://hacker-news.firebaseio.com/v0/topstories.json', { timeout_ms: 15000 });
    const items = [];
    for (const id of (Array.isArray(ids) ? ids : []).slice(0, limit)) {
      const item = await getJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout_ms: 10000 });
      if (item && item.title) items.push({ title: item.title, url: item.url || `https://news.ycombinator.com/item?id=${id}`, score: item.score, comments: item.descendants, by: item.by });
    }
    if (!items.length) { try { const rows = await parseFeed('https://hnrss.org/frontpage', limit); return { items: rows.map((row) => ({ title: row.title, url: row.url, date: row.date })), source: 'hnrss' }; } catch { /* keep empty */ } }
    return { items };
  } },
  mkdnews: { category: 'news', description: '\u0412\u0435\u0441\u0442\u0438 \u043e\u0434 \u041c\u0430\u043a\u0435\u0434\u043e\u043d\u0438\u0458\u0430', params: { limit: 'number' }, run: async (args) => {
    const result = await firstWorking(config.news.mk_feeds, Math.min(Number(args.limit) || 8, 25));
    return { source: result.url, items: result.items };
  } },
  world_news: { category: 'news', description: '\u0421\u0432\u0435\u0442\u0441\u043a\u0438 \u0432\u0435\u0441\u0442\u0438', params: { limit: 'number' }, run: async (args) => {
    const result = await firstWorking(config.news.world_feeds, Math.min(Number(args.limit) || 8, 25));
    return { source: result.url, items: result.items };
  } },
  tech_news: { category: 'news', description: '\u0422\u0435\u0445\u043d\u043e\u043b\u043e\u0448\u043a\u0438 \u0432\u0435\u0441\u0442\u0438', params: { limit: 'number' }, run: async (args) => {
    const result = await firstWorking(config.news.tech_feeds, Math.min(Number(args.limit) || 8, 25));
    return { source: result.url, items: result.items };
  } },
  rss_reader: { category: 'news', description: '\u0427\u0438\u0442\u0430\u0458 \u0431\u0438\u043b\u043e \u043a\u043e\u0458 RSS/Atom \u0444\u0438\u0434', params: { url: 'string', limit: 'number' }, run: async (args) => {
    if (!args.url) throw new Error('url is required');
    return { url: args.url, items: await parseFeed(args.url, Math.min(Number(args.limit) || 10, 40)) };
  } },
  news_bundle: { category: 'news', description: '\u041a\u043e\u043c\u0431\u0438\u043d\u0438\u0440\u0430\u043d \u043f\u0440\u0435\u0433\u043b\u0435\u0434: \u041c\u041a + \u0441\u0432\u0435\u0442 + \u0442\u0435\u0445', params: { scope: 'mk|world|tech' }, run: async (args) => {
    const scope = String(args.scope || '').toLowerCase();
    const out = { generated_at: new Date().toISOString(), sections: {} };
    if (!scope || scope === 'mk') { try { out.sections.mk = (await firstWorking(config.news.mk_feeds, 5)).items; } catch (error) { out.sections.mk_error = error.message; } }
    if (!scope || scope === 'world') { try { out.sections.world = (await firstWorking(config.news.world_feeds, 5)).items; } catch (error) { out.sections.world_error = error.message; } }
    if (!scope || scope === 'tech') { try { out.sections.tech = (await firstWorking(config.news.tech_feeds, 5)).items; } catch (error) { out.sections.tech_error = error.message; } }
    return out;
  } },
};
module.exports = { tools };
