'use strict';
const { request } = require('../lib/http');
async function check(id) {
  const registry = require('./registry');
  const adapters = id ? [registry.resolve(id)].filter(Boolean) : registry.list();
  const results = [];
  for (const adapter of adapters) {
    const started = Date.now();
    try {
      const response = await request(adapter.endpoint + (adapter.healthPath || '/'), { timeout_ms: 8000, retries: 0, accept: '*/*' });
      results.push({ id: adapter.id, status: 'reachable', ms: Date.now() - started, http: response.status, keyless: Boolean(adapter.keyless) });
    } catch (error) {
      results.push({ id: adapter.id, status: 'unreachable', ms: Date.now() - started, error: error.message, keyless: Boolean(adapter.keyless) });
    }
  }
  const reachable = results.filter((row) => row.status === 'reachable').length;
  return { checked_at: new Date().toISOString(), total: results.length, reachable, results };
}
function actions() {
  return [
    { name: 'integrations_health', category: 'integrations', description: '\u041f\u0440\u043e\u0432\u0435\u0440\u0438 \u0434\u0430\u043b\u0438 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u0438\u0442\u0435 \u0440\u0430\u0431\u043e\u0442\u0430\u0442', params: { id: 'string' }, handler: async (input) => check(input.id) },
  ];
}
module.exports = { check, actions };
