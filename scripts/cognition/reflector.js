'use strict';
const { appendJsonlSync, readJsonlSync } = require('../lib/fsx');
const { truncate } = require('../lib/textutil');
const config = require('../lib/config').load();
async function reflect(input = {}) {
  const { goal, plan: planDocument, observations = [] } = input;
  if (!goal) throw new Error('reflect needs a goal');
  const failed = observations.filter((observation) => !observation.ok);
  const success = observations.length > 0 && failed.length === 0;
  const lessons = [];
  if (!success && failed.length) lessons.push(`\u0417\u0430 "${truncate(goal, 60)}" \u0441\u043b\u0435\u0434\u043d\u043e\u0432\u043e \u043d\u0435 \u0440\u0430\u0431\u043e\u0442\u0435\u0448\u0435: ${failed.map((item) => `${item.action || item.step_id} (${truncate((item.error && item.error.message) || item.summary, 80)})`).join('; ')}`);
  const usedTools = [...new Set(observations.filter((item) => item.action).map((item) => item.action))];
  if (success && usedTools.length) lessons.push(`\u0417\u0430 "${truncate(goal, 60)}" \u0443\u0441\u043f\u0435\u0448\u043d\u0430 \u0441\u0435\u043a\u0432\u0435\u043d\u0446\u0430: ${usedTools.join(' -> ')}`);
  const strategies = [...new Set(observations.map((item) => item.strategy).filter(Boolean))];
  if (strategies.length) lessons.push(`\u0423\u0441\u043f\u0435\u0448\u043d\u0438 \u0441\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u0438: ${strategies.join(', ')}`);
  const reflection = { id: `reflection-${Date.now()}`, goal, success, steps: (planDocument && planDocument.steps ? planDocument.steps.length : 0), failed_steps: failed.length, tools: usedTools, lessons, at: new Date().toISOString() };
  appendJsonlSync(config.file.learned, { type: 'reflection', ...reflection });
  const learned = [];
  if (config.cognition.reflect_after_task) {
    const store = require('../memory/store');
    for (const lesson of lessons) learned.push((await store.learn(lesson, { source: 'reflection', tags: ['reflection', success ? 'success' : 'failure'], confidence: 0.8 })).fact.id);
  }
  return { ...reflection, learned_facts: learned };
}
function history(limit = 20) { return readJsonlSync(config.file.learned).filter((row) => row.type === 'reflection').slice(-limit); }
module.exports = { reflect, history };
