'use strict';
const planner = require('./planner');
const executor = require('./executor');
const observer = require('./observer');
const { replan } = require('./replan');
const reflector = require('./reflector');
const config = require('../lib/config').load();
const { shortId } = require('../lib/ids');
const logger = require('../lib/logger').createLogger('loop');
const conversations = require('../memory/conversations');
function needsTracking(goal, planDocument) {
  const actionable = (planDocument.steps || []).filter((step) => step.kind !== 'memory');
  return actionable.length > 1 || /(кампањ|campaign|продолж|следи|додека|while|until|постојано|ongoing)/iu.test(goal);
}
async function trackGoal(goal, planDocument, options = {}) {
  if (!needsTracking(goal, planDocument)) return null;
  const productivity = require('../tools/impl/productivity');
  const listed = await productivity.tools.todo.run({ action: 'list' });
  let item = listed.open.find((entry) => entry.id === options.task_id || entry.text === goal);
  if (!item) item = (await productivity.tools.todo.run({ action: 'add', text: goal })).added;
  const jobId = options.job_id || `hugo-task-${item.id}`;
  const scheduler = require('../automation/scheduler');
  if (!scheduler.list().some((job) => job.id === jobId)) scheduler.schedule({ id: jobId, action: 'goal', args: { goal, task_id: item.id, job_id: jobId, max_replans: 1 }, every_ms: 60000, label: goal });
  return { itemId: item.id, jobId };
}
async function finishTrackedGoal(tracking, success) {
  if (!tracking || !success) return;
  await require('../tools/impl/productivity').tools.todo.run({ action: 'done', id: tracking.itemId });
  require('../automation/scheduler').cancel(tracking.jobId);
}
async function runGoal(goal, options = {}) {
  if (!goal || typeof goal !== 'string') throw new Error('loop.runGoal needs a goal');
  const started = Date.now();
  const session = options.session || shortId('session');
  const maxReplans = options.maxReplans === undefined ? config.cognition.max_replans : options.maxReplans;
  let planDocument = planner.plan(goal, { session, maxSteps: options.maxSteps, argsFor: options.argsFor, minScore: options.minScore });
  const tracking = await trackGoal(goal, planDocument, options);
  const observations = [];
  const attempts = [];
  const tried = [];
  let replans = 0;
  while (true) {
    const executions = await executor.executePlan(planDocument, { context: options.context || {}, stopOnError: false });
    const tick = observer.observeAll(planDocument, executions);
    for (const observation of tick) {
      const step = (planDocument.steps || []).find((item) => item.id === observation.step_id);
      if (step && step.retry) observation.strategy = 'retry';
    }
    observations.push(...tick);
    attempts.push({ attempt: attempts.length + 1, steps: (planDocument.steps || []).length, ok: tick.filter((item) => item.ok).length });
    const failures = tick.filter((item) => !item.ok);
    if (!failures.length) break;
    replans += 1;
    const decision = replan({ plan: planDocument, observations: tick, attempt: replans, maxReplans, tried, browserFallback: options.browserFallback !== false });
    if (!decision) break;
    logger.info(`replan #${replans}: ${decision.strategy}`, { reason: decision.reason });
    if (decision.tried) tried.push(...decision.tried);
    planDocument = decision.plan;
    if (decision.strategy === 'stop') break;
    if (!(planDocument.steps || []).some((step) => step.status === 'pending')) break;
  }
  const reflection = config.cognition.reflect_after_task ? await reflector.reflect({ goal, plan: planDocument, observations }) : null;
  const result = {
    goal, session, plan_id: planDocument.id, steps: planDocument.steps, observations, attempts, replans, reflection,
    success: observations.length > 0 && !observations.some((item) => !item.ok), ms: Date.now() - started,
  };
  await finishTrackedGoal(tracking, result.success);
  result.tracking = tracking ? { ...tracking, pending: !result.success } : null;
  conversations.append({ type: 'goal_result', role: 'assistant', text: `\u0426\u0435\u043b: ${goal} \u2014 ${result.success ? '\u0443\u0441\u043f\u0435\u0448\u043d\u043e' : '\u0441\u043e \u0433\u0440\u0435\u0448\u043a\u0438'}`, session });
  return result;
}
module.exports = { runGoal };
