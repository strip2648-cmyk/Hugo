'use strict';
const config = require('../lib/config').load();
const { readJsonSync, writeJsonSync } = require('../lib/fsx');
const { NotFoundError, UnsupportedError } = require('../lib/errors');
const logger = require('../lib/logger').createLogger('tools');
const IMPL_MODULES = ['crypto', 'news', 'weather', 'geo', 'web', 'media', 'code', 'text', 'utils', 'productivity', 'fun', 'business', 'system', 'knowledge', 'files', 'hosttools', 'sites'];
let cache = null;
function loadImpls() {
  const tools = new Map();
  for (const name of IMPL_MODULES) {
    let module = null;
    try { module = require('./impl/' + name); }
    catch (error) { if (error && error.code === 'MODULE_NOT_FOUND') { logger.debug('tool module missing: ' + name); continue; } throw error; }
    for (const [id, definition] of Object.entries(module.tools || {})) {
      if (tools.has(id)) logger.warn('duplicate tool id overridden: ' + id);
      tools.set(id, { id, module: name, status: 'real', ...definition });
    }
  }
  return tools;
}
function catalog() { return readJsonSync(config.file.toolsCatalog, { tools: {} }).tools || {}; }
function all() {
  if (cache) return cache;
  const merged = new Map();
  for (const [id, definition] of Object.entries(catalog())) merged.set(id, { id, status: definition.status || 'planned', category: definition.category, name: definition.name, description: definition.description, params: definition.params || {} });
  for (const [id, definition] of loadImpls().entries()) {
    const previous = merged.get(id) || {};
    merged.set(id, { ...previous, ...definition, id, category: definition.category || previous.category || definition.module, implemented: true });
  }
  cache = merged;
  return merged;
}
function get(id) { return all().get(id) || null; }
function statusOf(entry) { return typeof entry.run === 'function' ? 'real' : (entry.status === 'browser' ? 'browser' : 'planned'); }
function list(options = {}) {
  let entries = [...all().values()];
  if (options.category) entries = entries.filter((entry) => entry.category === options.category);
  if (options.status) entries = entries.filter((entry) => statusOf(entry) === options.status);
  return entries.map((entry) => ({ id: entry.id, category: entry.category || 'other', status: statusOf(entry), description: entry.description, params: entry.params || {} })).sort((a, b) => String(a.category).localeCompare(String(b.category)) || a.id.localeCompare(b.id));
}
function categories() { const out = {}; for (const entry of all().values()) out[entry.category || 'other'] = (out[entry.category || 'other'] || 0) + 1; return out; }
async function call(id, args = {}, options = {}) {
  const entry = all().get(id);
  if (!entry) throw new NotFoundError('unknown tool: ' + id);
  if (typeof entry.run !== 'function') {
    if (entry.status === 'browser') {
      const eyes = require('../eyes/actions');
      return eyes.run('browser_search', { query: args.query || args.text || id, url: args.url });
    }
    throw new UnsupportedError('tool "' + id + '" is not implemented yet (status: ' + entry.status + ')', { tool: id, status: entry.status });
  }
  return entry.run(args || {}, options);
}
function audit() {
  const counts = { real: 0, browser: 0, planned: 0 };
  const byCategory = {};
  const entries = [...all().values()].map((entry) => {
    const status = statusOf(entry);
    const category = entry.category || 'other';
    counts[status] += 1;
    byCategory[category] = byCategory[category] || { real: 0, browser: 0, planned: 0 };
    byCategory[category][status] += 1;
    return { id: entry.id, category, name: entry.name || entry.id, status, description: entry.description || '' };
  }).sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
  const report = { version: config.version, generated_at: new Date().toISOString(), counts, by_category: byCategory, tools: entries };
  writeJsonSync(config.file.toolsStatus, report);
  return report;
}
function actions() {
  return [
    { name: 'tool_call', category: 'tools', description: '\u041f\u043e\u0432\u0438\u043a\u0430\u0458 \u0430\u043b\u0430\u0442\u043a\u0430 \u043f\u043e id', params: { tool: 'string', args: 'object' }, handler: async (input) => call(input.tool || input.id, input.args || input) },
    { name: 'tools_list', category: 'tools', description: '\u041b\u0438\u0441\u0442\u0430 \u043d\u0430 \u0430\u043b\u0430\u0442\u043a\u0438', params: { category: 'string' }, handler: async (input) => list({ category: input.category, status: input.status }) },
    { name: 'tools_stats', category: 'tools', description: '\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u043d\u0430 \u0430\u043b\u0430\u0442\u043a\u0438', params: {}, handler: async () => { const data = audit(); return { counts: data.counts, by_category: data.by_category }; } },
    { name: 'tools_audit', category: 'tools', description: '\u0410\u0432\u0434\u0438\u0442 \u0437\u0430 \u0441\u0435\u043a\u043e\u0458\u0430 \u0430\u043b\u0430\u0442\u043a\u0430', params: {}, handler: async () => audit() },
  ];
}
function reset() { cache = null; }
module.exports = { all, get, list, categories, call, audit, actions, reset, catalog, statusOf, count: () => all().size };
