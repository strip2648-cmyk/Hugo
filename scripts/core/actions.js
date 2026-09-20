'use strict';
const logger = require('../lib/logger').createLogger('actions');
function optional(path) {
  try { return require(path); } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') { logger.debug(`optional module missing: ${path}`); return null; }
    throw error;
  }
}
const INTERNAL = [
  { name: 'goal', category: 'cognition', safety: 'write', description: '\u041f\u043b\u0430\u043d\u0438\u0440\u0430\u0458 \u0438 \u0438\u0437\u0432\u0440\u0448\u0438 \u0446\u0435\u043b (\u043f\u043b\u0430\u043d -> \u0438\u0437\u0432\u0440\u0448\u0438 -> \u043d\u0430\u0431\u0459\u0443\u0434\u0443\u0432\u0430\u0458 -> \u043f\u0440\u0435\u0438\u0441\u043f\u0438\u0442\u0430\u0458 -> \u0440\u0435\u0444\u043b\u0435\u043a\u0442\u0438\u0440\u0430\u0458)', params: { goal: 'string' }, handler: async (input, options) => require('../cognition/loop').runGoal(input.goal || input.task, { session: options.session, maxReplans: input.max_replans }) },
  { name: 'plan', category: 'cognition', safety: 'read', description: '\u0421\u0430\u043c\u043e \u043f\u043b\u0430\u043d \u0431\u0435\u0437 \u0438\u0437\u0432\u0440\u0448\u0443\u0432\u0430\u045a\u0435', params: { goal: 'string' }, handler: async (input, options) => require('../cognition/planner').plan(input.goal || input.task, { session: options.session }) },
  { name: 'reason', category: 'cognition', safety: 'read', description: '\u041b\u043e\u043a\u0430\u043b\u043d\u043e \u0440\u0430\u0441\u0443\u0434\u0443\u0432\u0430\u045a\u0435 \u0437\u0430 \u043f\u0440\u043e\u0431\u043b\u0435\u043c', params: { problem: 'string' }, handler: async (input) => require('../cognition/reasoner').reason(input.problem || input.text, { memory: input.memory }) },
  { name: 'remember', category: 'memory', safety: 'write', description: '\u0417\u0430\u043f\u0430\u043c\u0442\u0438 \u0444\u0430\u043a\u0442', params: { text: 'string', tags: 'array' }, handler: async (input) => require('../memory/store').learn(input.text, { tags: input.tags, source: input.source || 'user', confidence: input.confidence }) },
  { name: 'recall', category: 'memory', safety: 'read', description: '\u0421\u0435\u043c\u0430\u043d\u0442\u0438\u0447\u043a\u043e \u043f\u0440\u0435\u0431\u0430\u0440\u0443\u0432\u0430\u045a\u0435 \u043d\u0438\u0437 \u043c\u0435\u043c\u043e\u0440\u0438\u0458\u0430\u0442\u0430', params: { query: 'string', limit: 'number' }, handler: async (input) => require('../memory/store').recall(input.query || input.text, { limit: input.limit || 10, tag: input.tag }) },
  { name: 'memory_forget', category: 'memory', safety: 'write', description: '\u0417\u0430\u0431\u043e\u0440\u0430\u0432\u0438 \u0444\u0430\u043a\u0442 \u043f\u043e id', params: { id: 'string' }, handler: async (input) => require('../memory/store').forget(input.id) },
  { name: 'memory_forget_by_text', category: 'memory', safety: 'write', description: '\u0417\u0430\u0431\u043e\u0440\u0430\u0432\u0438 \u0444\u0430\u043a\u0442 \u043f\u043e \u0442\u0435\u043a\u0441\u0442', params: { text: 'string' }, handler: async (input) => { const store = require('../memory/store'); const hit = store.recall(input.text, { limit: 1 }).hits[0]; return hit ? store.forget(hit.id) : { forgotten: false }; } },
  { name: 'memory_list', category: 'memory', safety: 'read', description: '\u041b\u0438\u0441\u0442\u0430 \u043d\u0430 \u0437\u0430\u043f\u0430\u043c\u0435\u0442\u0435\u043d\u0438 \u0444\u0430\u043a\u0442\u0438', params: { tag: 'string', limit: 'number' }, handler: async (input) => require('../memory/store').list({ tag: input.tag, limit: input.limit || 50 }) },
  { name: 'memory_stats', category: 'memory', safety: 'read', description: '\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u043d\u0430 \u043c\u0435\u043c\u043e\u0440\u0438\u0458\u0430\u0442\u0430', params: {}, handler: async () => require('../memory/store').stats() },
  { name: 'memory_export', category: 'memory', safety: 'read', description: '\u0418\u0437\u0432\u0435\u0437\u0438 \u0446\u0435\u043b\u0430 \u043c\u0435\u043c\u043e\u0440\u0438\u0458\u0430 (\u0431\u0435\u043a\u0430\u043f)', params: {}, handler: async () => require('../memory/store').exportBundle() },
  { name: 'memory_import', category: 'memory', safety: 'write', description: '\u0423\u0432\u0435\u0437\u0438 \u043c\u0435\u043c\u043e\u0440\u0438\u0458\u0430 \u043e\u0434 \u0431\u0435\u043a\u0430\u043f', params: { bundle: 'object' }, handler: async (input) => require('../memory/store').importBundle(input.bundle, { force: input.force }) },
  { name: 'memory_prune', category: 'memory', safety: 'write', description: '\u041e\u0447\u0438\u0441\u0442\u0438 \u0441\u0442\u0430\u0440\u0438 \u0440\u0430\u0437\u0433\u043e\u0432\u043e\u0440\u0438 \u043f\u043e retention', params: { days: 'number' }, handler: async (input) => require('../memory/store').enforceRetention(input.days) },
  { name: 'memory_ingest', category: 'memory', safety: 'write', description: '\u0418\u0437\u0432\u043b\u0435\u0447\u0438 \u0444\u0430\u043a\u0442\u0438 \u043e\u0434 \u0440\u0430\u0437\u0433\u043e\u0432\u043e\u0440\u0438', params: { all: 'boolean' }, handler: async (input) => require('../memory/conversations').ingest({ all: Boolean(input.all), maxLines: input.max_lines }) },
  { name: 'memory_timeline', category: 'memory', safety: 'read', description: '\u041a\u043e\u0433\u0430 \u0448\u0442\u043e \u0435 \u043d\u0430\u0443\u0447\u0435\u043d\u043e', params: { limit: 'number' }, handler: async (input) => require('../memory/temporal').timeline(input.limit || 20) },
  { name: 'graph_query', category: 'memory', safety: 'read', description: '\u0417\u043d\u0430\u0435\u045a\u0435 \u0437\u0430 \u0435\u043d\u0442\u0438\u0442\u0435\u0442', params: { entity: 'string' }, handler: async (input) => require('../memory/graph').query(input.entity) },
  { name: 'graph_search', category: 'memory', safety: 'read', description: '\u041f\u0440\u0435\u0431\u0430\u0440\u0430\u0458 \u0435\u043d\u0442\u0438\u0442\u0435\u0442\u0438', params: { term: 'string' }, handler: async (input) => require('../memory/graph').searchEntities(input.term, input.limit || 10) },
  { name: 'conversations', category: 'memory', safety: 'read', description: '\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438 \u0440\u0430\u0437\u0433\u043e\u0432\u043e\u0440\u0438', params: { limit: 'number' }, handler: async (input) => require('../memory/conversations').recent(input.limit || 20) },
  { name: 'todo', category: 'productivity', safety: 'write', description: '\u0417\u0430\u0434\u0430\u0447\u0438', params: { action: 'add|list|done|remove|clear', text: 'string', due_at: 'ISO' }, handler: async (input) => require('../tools/impl/productivity').tools.todo.run(input) },
  { name: 'note', category: 'productivity', safety: 'write', description: '\u0411\u0435\u043b\u0435\u0448\u043a\u0438', params: { action: 'save|get|list|remove', title: 'string', text: 'string' }, handler: async (input) => require('../tools/impl/productivity').tools.note.run(input) },
  { name: 'reminder_add', category: 'productivity', safety: 'write', description: '\u041f\u043e\u0442\u0441\u0435\u0442\u043d\u0438\u043a', params: { text: 'string', due_at: 'ISO' }, handler: async (input) => require('../tools/impl/productivity').tools.reminder_add.run(input) },
  { name: 'pomodoro', category: 'productivity', safety: 'write', description: 'Pomodoro', params: { action: 'start|status|stop', minutes: 'number' }, handler: async (input) => require('../tools/impl/productivity').tools.pomodoro.run(input) },
  { name: 'habit', category: 'productivity', safety: 'write', description: '\u041d\u0430\u0432\u0438\u043a\u0438', params: { action: 'check|list', name: 'string' }, handler: async (input) => require('../tools/impl/productivity').tools.habit.run(input) },
  { name: 'journal', category: 'productivity', safety: 'write', description: '\u0414\u043d\u0435\u0432\u043d\u0438\u043a', params: { action: 'write|read', text: 'string' }, handler: async (input) => require('../tools/impl/productivity').tools.journal.run(input) },
  { name: 'kanban', category: 'productivity', safety: 'write', description: 'Kanban', params: { action: 'add|move|list', text: 'string', column: 'string', id: 'string' }, handler: async (input) => require('../tools/impl/productivity').tools.kanban.run(input) },
  { name: 'mood_tracker', category: 'productivity', safety: 'write', description: '\u0421\u043b\u0435\u0434\u0435\u045a\u0435 \u043d\u0430 \u0440\u0430\u0441\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435', params: { score: '1-5', note: 'string' }, handler: async (input) => require('../tools/impl/productivity').tools.mood_tracker.run(input) },
  { name: 'help', category: 'system', safety: 'read', description: '\u0428\u0442\u043e HUGO \u043c\u043e\u0436\u0435 \u0434\u0430 \u043d\u0430\u043f\u0440\u0430\u0432\u0438', params: {}, handler: async () => require('./capabilities').report() },
];
const DYNAMIC = [
  '../tools/registry', '../agents/registry', '../eyes/actions', '../voice/speech', '../business/campaigns', '../business/crm', '../business/analytics', '../business/publisher',
  '../automation/scheduler', '../automation/reminders', '../automation/digest', '../automation/autolearn', '../automation/memorysync',
  '../eyes/vision', '../lib/confirm',
  '../integrations/registry', '../integrations/mcp',
];
let registry = null;
function build() {
  const map = new Map();
  for (const definition of INTERNAL) map.set(definition.name, { ...definition, source: 'core' });
  for (const path of DYNAMIC) {
    const module = optional(path);
    if (!module || typeof module.actions !== 'function') continue;
    for (const definition of module.actions()) {
      if (!definition || !definition.name || typeof definition.handler !== 'function') continue;
      map.set(definition.name, { ...definition, source: path });
    }
  }
  const toolRegistry = optional('../tools/registry');
  if (toolRegistry) {
    for (const entry of toolRegistry.all().values()) {
      if (!entry || map.has(entry.id) || typeof entry.run !== 'function') continue;
      const toolId = entry.id;
      map.set(toolId, {
        name: toolId,
        category: entry.category || 'tools',
        safety: 'read',
        description: entry.description || entry.name || toolId,
        params: entry.params || {},
        source: 'tool:' + toolId,
        handler: async (input, options) => toolRegistry.call(toolId, input || {}, options || {}),
      });
    }
  }
  return map;
}
function get() {
  if (!registry) registry = build();
  return registry;
}
function reset() { registry = null; }
function find(name) { return get().get(name) || null; }
function names() { return [...get().keys()].sort(); }
function list() {
  return [...get().values()].map(({ name, category, description, params, safety }) => ({ name, category: category || 'other', description, params: params || {}, safety: safety || 'read' }));
}
function byCategory() {
  const out = {};
  for (const entry of list()) { out[entry.category] = out[entry.category] || []; out[entry.category].push(entry.name); }
  return out;
}
module.exports = { find, names, list, byCategory, get, build, reset, count: () => get().size };
