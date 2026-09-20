'use strict';
const config = require('../lib/config').load();
const { shortId } = require('../lib/ids');
const { routeIntent } = require('./reasoner');
const router = require('./router');
const { truncate } = require('../lib/textutil');
const conversations = require('../memory/conversations');
const CONNECTORS = /\s*(?:;|,?\s*(?:\u043f\u043e\u0442\u043e\u0430|\u0438 \u043f\u043e\u0442\u043e\u0430|\u0438 \u0434\u0430|\u043f\u0430 \u043f\u043e\u0442\u043e\u0430|then|and then|after that)|\.\s+)\s*/i;
function clauses(goal) { return String(goal).split(CONNECTORS).map((part) => part.trim()).filter((part) => part.length > 2); }
function safeStore() { try { return require('../memory/store'); } catch { return null; } }
function isExecutable(tool) {
  try {
    const registry = require('../tools/registry');
    const entry = registry.get(tool);
    if (entry && (registry.statusOf(entry) === 'real' || registry.statusOf(entry) === 'browser')) return true;
    return Boolean(require('../core/actions').find(tool));
  }
  catch { return false; }
}
function memoryStep(goal) {
  const store = safeStore();
  if (!store) return null;
  const hits = store.recall(goal, { limit: 3 });
  if (!hits.hits.length) return null;
  return { id: 'step-1', kind: 'memory', description: `\u041f\u043e\u0442\u0441\u0435\u0442\u0438 \u0441\u0435 \u0448\u0442\u043e \u0437\u043d\u0430\u043c \u0437\u0430: ${truncate(goal, 60)}`, action: 'recall', args: { query: goal, limit: 3 } };
}
function buildSteps(goal, options = {}) {
  const parts = options.steps || clauses(goal);
  const steps = [];
  const maxSteps = options.maxSteps || config.cognition.max_steps;
  for (const part of parts) {
    if (steps.length >= maxSteps) break;
    const routed = router.routeStep(part);
    if (routed && isExecutable(routed.action) && options.preferRouter !== false) {
      steps.push({ id: `step-${steps.length + 1}`, kind: 'tool', description: truncate(part, 140), status: 'pending', action: routed.action, args: options.argsFor ? options.argsFor(part, { tool: routed.action }) : routed.args, label: routed.label, match_score: routed.score, route_source: routed.source });
      continue;
    }
    const intentHits = routeIntent(part, { limit: 8, minScore: options.minScore === undefined ? 1 : options.minScore });
    const match = intentHits.find((hit) => isExecutable(hit.tool));
    const step = {
      id: `step-${steps.length + 1}`,
      kind: match ? 'tool' : (options.agentHint ? 'agent' : 'reason'),
      description: truncate(part, 140), status: 'pending',
    };
    if (match) {
      step.action = match.tool;
      step.args = options.argsFor ? options.argsFor(part, match) : { query: part, text: part };
      step.category = match.category;
      step.match_score = match.score;
    }
    steps.push(step);
  }
  for (const step of steps) if (!step.action && step.kind !== 'memory') { step.kind = 'blocked'; step.reason = step.reason || 'немам алат што сигурно го прави ова'; }
  for (let index = 0; index < steps.length; index += 1) steps[index].depends_on = index ? [steps[index - 1].id] : [];
  return steps;
}
function decompose(goal, options = {}) {
  if (typeof goal !== 'string' || !goal.trim()) throw new Error('plan needs a goal');
  const steps = buildSteps(goal, options);
  const recall = options.withMemory === false ? null : memoryStep(goal);
  const all = recall ? [recall, ...steps.map((step, index) => ({ ...step, id: `step-${index + 2}`, depends_on: [recall.id] }))] : steps;
  return { id: shortId('plan'), goal: goal.trim(), steps: all, status: 'planned', max_steps: options.maxSteps || config.cognition.max_steps, created_at: new Date().toISOString() };
}
function plan(goal, options = {}) {
  const result = decompose(goal, options);
  conversations.append({ type: 'plan', role: 'system', text: `\u041f\u043b\u0430\u043d: ${result.goal}`, plan: result, session: options.session });
  return result;
}
function revise(planDocument, changes = {}) { return { ...planDocument, ...changes, revised_at: new Date().toISOString() }; }
function progress(planDocument) {
  const steps = planDocument.steps || [];
  const done = steps.filter((step) => step.status === 'done').length;
  return { total: steps.length, done, pending: steps.filter((step) => step.status === 'pending').length, failed: steps.filter((step) => step.status === 'failed').length, percent: steps.length ? Math.round((done / steps.length) * 100) : 0 };
}
module.exports = { plan, decompose, buildSteps, revise, progress, clauses, route: require('./router').route, routeStep: require('./router').routeStep };
