'use strict';
const logger = require('../lib/logger').createLogger('executor');
const { verify } = require('./verify');
function tools() { try { return require('../tools/registry'); } catch { return null; } }
function agents() { try { return require('../agents/registry'); } catch { return null; } }
function browser() { try { return require('../eyes/actions'); } catch { return null; } }
async function executeStep(step, context = {}) {
  const started = Date.now();
  const base = { step_id: step.id, kind: step.kind, description: step.description };
  if (step.kind === 'blocked') throw new Error(step.reason || 'немам алат за овој чекор');
  if (step.kind === 'memory') {
    const store = require('../memory/store');
    if (step.action === 'recall') return { ...base, output: store.recall(step.args.query, { limit: step.args.limit || 5 }), ms: Date.now() - started };
    if (step.action === 'remember') return { ...base, output: await store.learn(step.args.text, step.args.metadata || {}), ms: Date.now() - started };
    return { ...base, output: store.list({ limit: 10 }), ms: Date.now() - started };
  }
  if (step.kind === 'tool') {
    const registry = tools();
    if (!registry) throw new Error('tool registry is not available');
    try {
      return { ...base, action: step.action, output: await registry.call(step.action, { ...(step.args || {}), context: context.context || {} }), ms: Date.now() - started };
    } catch (error) {
      const core = require('../core/actions').find(step.action);
      if (error.code !== 'HUGO_NOT_FOUND' || !core) throw error;
      return { ...base, action: step.action, output: await core.handler(step.args || {}, {}), ms: Date.now() - started };
    }
  }
  if (step.kind === 'browser') {
    const eyes = browser();
    if (!eyes) throw new Error('browser module is not available');
    return { ...base, action: step.action, output: await eyes.run(step.action, step.args || {}), ms: Date.now() - started };
  }
  if (step.kind === 'agent') {
    const registry = agents();
    if (!registry) throw new Error('agent registry is not available');
    const agent = step.agent_id ? registry.get(step.agent_id) : registry.route(step.description, { limit: 1 })[0];
    return { ...base, agent: agent ? agent.id : null, output: await registry.run(agent, step.description, { context: context.context || {} }), ms: Date.now() - started };
  }
  const output = await require('./reasoner').reason(step.description, { memory: context.memory }, {});
  return { ...base, output, ms: Date.now() - started };
}
async function executePlan(planDocument, context = {}) {
  const results = [];
  for (const step of planDocument.steps || []) {
    if (step.status === 'done') continue;
    try {
      step.status = 'running';
      const output = await executeStep(step, context);
      const check = await verify(step.action || step.kind, step.args || {}, output);
      const ok = check.verified !== false && !check.blocked;
      step.status = ok ? 'done' : 'failed';
      step.verified = check.verified;
      results.push({ ...output, ok, verified: check.verified, verified_how: check.how, blocked: Boolean(check.blocked) });
    } catch (error) {
      step.status = 'failed';
      logger.warn(`step failed: ${step.id}`, { message: error.message });
      results.push({ step_id: step.id, ok: false, error: { message: error.message, code: error.code || 'HUGO_ERROR' } });
      if (context.stopOnError) break;
    }
  }
  return results;
}
module.exports = { executeStep, executePlan };
