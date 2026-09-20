'use strict';
const { truncate } = require('../lib/textutil');
const conversations = require('../memory/conversations');
function summarize(output) {
  if (output === null || output === undefined) return 'no output';
  if (typeof output === 'string') return truncate(output, 200);
  if (Array.isArray(output)) return `${output.length} items`;
  if (typeof output === 'object') {
    if (output.hits) return `${output.hits.length} memory hits`;
    if (output.title && output.summary) return `${output.title}: ${truncate(output.summary, 120)}`;
    if (output.reply) return truncate(output.reply, 200);
    if (output.items) return `${output.items.length || Object.keys(output.items).length} items`;
    if (output.error) return `error: ${output.error.message || output.error}`;
    return `object(${Object.keys(output).slice(0, 6).join(', ')})`;
  }
  return String(output);
}
function observe(step, execution) {
  const observation = {
    id: `obs-${step.id}-${Date.now()}`, step_id: step.id, description: step.description, kind: step.kind,
    action: execution.action || null, ok: execution.ok !== false && execution.verified !== false, verified: execution.verified === undefined ? null : execution.verified, verified_how: execution.verified_how || null, blocked: Boolean(execution.blocked), ms: execution.ms || 0,
    summary: summarize(execution.output), output: execution.output === undefined ? null : execution.output,
    error: execution.error || null, at: new Date().toISOString(),
  };
  conversations.append({ type: 'observation', role: 'system', text: `${observation.ok ? 'OK' : 'FAIL'} ${step.id}: ${observation.summary}`, observation });
  return observation;
}
function observeAll(planDocument, executions) {
  const byStep = new Map(executions.map((execution) => [execution.step_id, execution]));
  return (planDocument.steps || []).map((step) => observe(step, byStep.get(step.id) || { ok: false, error: { message: 'step did not run' } }));
}
function failures(observations) { return observations.filter((observation) => !observation.ok); }
module.exports = { observe, observeAll, failures, summarize };
