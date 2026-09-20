'use strict';
const config = require('../lib/config').load();
async function run(options = {}) {
  const tools = require('../tools/registry');
  const sources = options.repos || config.learning.sources;
  const results = [];
  for (const repo of sources) {
    try {
      const result = await tools.call('learn_from_repo', { repo, limit: options.limit || config.learning.max_items_per_repo });
      results.push({ repo, ok: true, facts: result.facts_learned, items: result.items_found });
    } catch (error) {
      results.push({ repo, ok: false, error: error.message });
    }
  }
  const total = results.reduce((sum, row) => sum + (row.facts || 0), 0);
  return { repos: results.length, facts_learned: total, results, at: new Date().toISOString() };
}
function actions() {
  return [
    { name: 'autolearn_run', category: 'automation', description: '\u0423\u0447\u0438 \u043e\u0434 \u043f\u043e\u0437\u043d\u0430\u0442\u0438 Git \u0440\u0435\u043f\u043e\u0437\u0438\u0442\u043e\u0440\u0438\u0443\u043c\u0438', params: { limit: 'number' }, handler: async (input) => run(input) },
    { name: 'autolearn_sources', category: 'automation', description: '\u0418\u0437\u0432\u043e\u0440\u0438 \u0437\u0430 \u0443\u0447\u0435\u045a\u0435', params: {}, handler: async () => ({ sources: config.learning.sources, max_items_per_repo: config.learning.max_items_per_repo }) },
  ];
}
module.exports = { run, actions };
