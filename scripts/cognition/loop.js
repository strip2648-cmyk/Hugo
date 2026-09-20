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
async function runGoal(goal, options = {}) {
  if (!goal || typeof goal !== 'string') throw new Error('loop.runGoal needs a goal');
  const started = Date.now();
  const session = options.session || shortId('session');
  const maxReplans = options.maxReplans === undefined ? config.cognition.max_replans : options.maxReplans;
  let planDocument = planner.plan(goal, { session, maxSteps: options.maxSteps, argsFor: options.argsFor, minScore: options.minScore });
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
  conversations.append({ type: 'goal_result', role: 'assistant', text: `\u0426\u0435\u043b: ${goal} \u2014 ${result.success ? '\u0443\u0441\u043f\u0435\u0448\u043d\u043e' : '\u0441\u043e \u0433\u0440\u0435\u0448\u043a\u0438'}`, session });
  return result;
}
module.exports = { runGoal };
