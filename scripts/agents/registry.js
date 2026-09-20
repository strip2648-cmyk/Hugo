'use strict';
const config = require('../lib/config').load();
const { readJsonSync } = require('../lib/fsx');
const { bestMatch } = require('../lib/scope');
const { truncate, tokens } = require('../lib/textutil');
const { reason, synthesize } = require('../cognition/reasoner');
let cache = null;
function load() {
  if (cache) return cache;
  const raw = readJsonSync(config.file.agents, { agents: [] });
  const agents = raw.agents || [];
  const byId = new Map();
  const byCategory = new Map();
  for (const agent of agents) {
    byId.set(agent.id, agent);
    const list = byCategory.get(agent.category) || [];
    list.push(agent);
    byCategory.set(agent.category, list);
  }
  cache = { generated: raw.generated || null, total: agents.length, categories: byCategory, agents, byId };
  return cache;
}
function stats() {
  const data = load();
  const counts = [...data.categories.entries()].map(([category, list]) => ({ category, agents: list.length })).sort((a, b) => b.agents - a.agents);
  return { total: data.total, categories: data.categories.size, generated: data.generated, top_categories: counts.slice(0, 12) };
}
function list(options = {}) {
  const data = load();
  const agents = options.category ? (data.categories.get(options.category) || []) : data.agents;
  return agents.slice(0, options.limit || 40).map((agent) => ({ id: agent.id, name: agent.name, category: agent.category, role: agent.role, technology: agent.technology }));
}
function get(id) { return load().byId.get(id) || null; }
function categories(query, limit = 8) {
  const data = load();
  const needle = tokens(query);
  const scored = [];
  for (const [category, agents] of data.categories.entries()) {
    const categoryTokens = new Set(category.split('_'));
    let score = 0;
    for (const token of needle) {
      if (categoryTokens.has(token)) score += 3;
      else if (category.includes(token)) score += 1;
    }
    if (score > 0) scored.push({ category, score, agents: agents.length });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
function route(task, options = {}) {
  const data = load();
  const pool = options.category ? (data.categories.get(options.category) || []) : data.agents;
  const hits = bestMatch(task, pool, {
    limit: options.limit || 5, minScore: options.minScore || 3, key: (agent) => agent.id,
    keywords: (agent) => [agent.name, agent.role, agent.technology, String(agent.category || '').replace(/_/g, ' ')],
  });
  if (hits.length) return hits.map((hit) => hit.record);
  const byCategory = categories(task, 1)[0];
  if (byCategory) return (data.categories.get(byCategory.category) || []).slice(0, options.limit || 3);
  return pool.slice(0, options.limit || 3);
}
async function run(agent, task, options = {}) {
  if (!agent) throw new Error('agent.run needs an agent');
  const system = agent.system_prompt || `\u0422\u0438 \u0441\u0438 ${agent.name}, \u0435\u043a\u0441\u043f\u0435\u0440\u0442 \u0437\u0430 ${agent.technology || agent.category}. \u041e\u0434\u0433\u043e\u0432\u0430\u0440\u0430\u0458 \u043a\u0440\u0430\u0442\u043a\u043e \u0438 \u043f\u0440\u0430\u043a\u0442\u0438\u0447\u043d\u043e.`;
  const analysis = await reason(task, { memory: options.context && options.context.memory }, { system, memory: false, endpoint: options.endpoint });
  const output = analysis.provider === 'local-model' && analysis.content
    ? analysis.content
    : `${agent.name} (${agent.category}): ${analysis.conclusion}${analysis.next_actions.length ? ` \u0427\u0435\u043a\u043e\u0440: ${analysis.next_actions[0]}` : ''}`;
  return {
    agent: { id: agent.id, name: agent.name, category: agent.category, role: agent.role },
    prompt_used: truncate(system, 160), provider: analysis.provider, output,
    analysis: { kind: analysis.kind, assumptions: analysis.assumptions, options: analysis.options.slice(0, 3) },
  };
}
async function orchestrate(task, options = {}) {
  if (!task || typeof task !== 'string') throw new Error('orchestrate needs a task');
  const max = options.max || 3;
  const chosen = [];
  for (const entry of categories(task, max)) {
    const candidate = route(task, { category: entry.category, limit: 1 })[0];
    if (candidate && !chosen.some((agent) => agent.id === candidate.id)) chosen.push(candidate);
  }
  if (!chosen.length) chosen.push(...route(task, { limit: Math.min(max, 2) }));
  const results = [];
  for (const agent of chosen.slice(0, max)) results.push(await run(agent, task, options));
  const synthesis = synthesize(task, results.map((result) => `${result.agent.name}: ${truncate(result.output, 200)}`), { max: 1200 });
  return { task, agents: results.map((result) => result.agent), results, synthesis, note: chosen.length > 1 ? `\u0430\u043d\u0433\u0430\u0436\u0438\u0440\u0430\u043d\u0438 ${chosen.length} \u0430\u0433\u0435\u043d\u0442\u0438` : '\u0435\u0434\u0435\u043d \u0430\u0433\u0435\u043d\u0442' };
}
function actions() {
  return [
    { name: 'agent_route', category: 'agents', description: '\u041d\u0430\u0458\u0434\u0438 \u043d\u0430\u0458\u0441\u043e\u043e\u0434\u0432\u0435\u0442\u043d\u0438 \u0430\u0433\u0435\u043d\u0442\u0438 \u0437\u0430 \u0437\u0430\u0434\u0430\u0447\u0430', params: { task: 'string' }, handler: async (input) => route(input.task, { limit: input.limit || 5 }) },
    { name: 'agent_run', category: 'agents', description: '\u0418\u0437\u0432\u0440\u0448\u0438 \u0437\u0430\u0434\u0430\u0447\u0430 \u0441\u043e \u043e\u0434\u0440\u0435\u0434\u0435\u043d \u0430\u0433\u0435\u043d\u0442', params: { agent_id: 'string', task: 'string' }, handler: async (input) => run(input.agent_id ? get(input.agent_id) : route(input.task, { limit: 1 })[0], input.task) },
    { name: 'agent_orchestrate', category: 'agents', description: '\u041f\u043e\u0432\u0435\u045c\u0435-\u0430\u0433\u0435\u043d\u0442\u043d\u0430 \u043e\u0440\u043a\u0435\u0441\u0442\u0440\u0430\u0446\u0438\u0458\u0430', params: { task: 'string' }, handler: async (input) => orchestrate(input.task, { max: input.max || 3 }) },
    { name: 'agents_stats', category: 'agents', description: '\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u0437\u0430 \u0430\u0433\u0435\u043d\u0442\u0438\u0442\u0435', params: {}, handler: async () => stats() },
  ];
}
module.exports = { load, stats, list, get, route, run, orchestrate, categories, actions };
