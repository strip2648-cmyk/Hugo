'use strict';
const { routeIntent } = require('./reasoner');
const { clauses } = require('./planner');
function alternatives(failedStep, triedActions = []) {
  let registry = null;
  try { registry = require('../tools/registry'); } catch { registry = null; }
  return routeIntent(failedStep.description, { limit: 12 })
    .filter((hit) => !triedActions.includes(hit.tool))
    .filter((hit) => !registry || Boolean(registry.get(hit.tool) && typeof registry.get(hit.tool).run === 'function'));
}
function replan(context = {}) {
  const { plan: planDocument, observations = [], attempt = 1, tried = [] } = context;
  const failed = observations.filter((observation) => !observation.ok);
  if (!failed.length) return null;
  const failure = failed[0];
  const step = (planDocument.steps || []).find((item) => item.id === failure.step_id);
  if (!step) return null;
  const maxReplans = context.maxReplans || 3;
  if (attempt > maxReplans) return { strategy: 'stop', reason: `\u0434\u043e\u0441\u0442\u0438\u0433\u043d\u0430\u0442 \u043c\u0430\u043a\u0441\u0438\u043c\u0443\u043c \u043e\u0434 ${maxReplans} \u043f\u0440\u0435\u0438\u0441\u043f\u0438\u0442\u0443\u0432\u0430\u045a\u0430`, plan: planDocument };
  const message = String((failure.error && failure.error.message) || '');
  if (/network|fetch failed|ENOTFOUND|EAI_AGAIN|timeout|aborted|HTTP 5/i.test(message)) {
    step.status = 'pending';
    step.retry = (step.retry || 0) + 1;
    return { strategy: 'retry', reason: `\u043c\u0440\u0435\u0436\u043d\u0430 \u0433\u0440\u0435\u0448\u043a\u0430, \u043f\u043e\u0432\u0442\u043e\u0440\u0443\u0432\u0430\u043c (\u043e\u0431\u0438\u0434 ${step.retry})`, plan: planDocument };
  }
  if (/(403|blocked|forbidden|429|captcha|cloudflare)/i.test(message) && context.browserFallback !== false) {
    step.kind = 'browser';
    step.action = 'browser_read';
    step.status = 'pending';
    step.args = { url: step.args && step.args.url ? step.args.url : undefined, query: step.description };
    return { strategy: 'browser-fallback', reason: '\u0441\u0430\u0458\u0442\u043e\u0442 \u0431\u043b\u043e\u043a\u0438\u0440\u0430 \u0434\u0438\u0440\u0435\u043a\u0442\u043d\u043e \u0447\u0438\u0442\u0430\u045a\u0435; \u0433\u043e \u043a\u043e\u0440\u0438\u0441\u0442\u0430\u043c \u0442\u0432\u043e\u0458\u043e\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440', plan: planDocument };
  }
  const candidates = alternatives(step, tried);
  if (candidates.length) {
    tried.push(step.action);
    step.action = candidates[0].tool;
    step.category = candidates[0].category;
    step.kind = 'tool';
    step.status = 'pending';
    return { strategy: 'alternative-tool', reason: `\u043f\u0440\u043e\u0431\u0443\u0432\u0430\u043c ${candidates[0].tool}`, plan: planDocument, tried: [...tried] };
  }
  const parts = clauses(step.description);
  if (parts.length > 1) {
    const index = (planDocument.steps || []).findIndex((item) => item.id === step.id);
    const replacements = parts.map((part, offset) => ({ id: `${step.id}.${offset + 1}`, kind: 'reason', description: part, status: 'pending', depends_on: offset ? [`${step.id}.${offset}`] : (step.depends_on || []) }));
    planDocument.steps.splice(index, 1, ...replacements);
    return { strategy: 'split', reason: '\u0437\u0430\u0434\u0430\u0447\u0430\u0442\u0430 \u0435 \u043f\u043e\u0434\u0435\u043b\u0435\u043d\u0430 \u043d\u0430 \u043f\u043e\u043c\u0430\u043b\u0438 \u0447\u0435\u043a\u043e\u0440\u0438', plan: planDocument };
  }
  step.status = 'skipped';
  step.note = `\u043f\u0440\u0435\u0441\u043a\u043e\u043a\u043d\u0430\u0442 \u043f\u043e ${attempt} \u043e\u0431\u0438\u0434\u0438: ${message || '\u043d\u0435\u043f\u043e\u0437\u043d\u0430\u0442\u0430 \u0433\u0440\u0435\u0448\u043a\u0430'}`;
  return { strategy: 'skip-and-report', reason: `\u0447\u0435\u043a\u043e\u0440\u0438\u0442\u0435 \u043d\u0435 \u043c\u043e\u0436\u0435\u0430 \u0434\u0430 \u0441\u0435 \u0438\u0437\u0432\u0440\u0448\u0430\u0442: ${message || '\u043d\u0435\u043f\u043e\u0437\u043d\u0430\u0442\u0430 \u0433\u0440\u0435\u0448\u043a\u0430'}`, plan: planDocument };
}
module.exports = { replan, alternatives };
