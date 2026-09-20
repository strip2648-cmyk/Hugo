'use strict';
const { readJsonSync, readJsonlSync } = require('../lib/fsx');
const config = require('../lib/config').load();
function collect() {
  const store = require('../memory/store');
  const stats = store.stats();
  const todosData = readJsonSync(config.file.todos, { items: [] });
  const todos = Array.isArray(todosData) ? todosData : (todosData.items || []);
  const due = todos.filter((item) => !item.done && item.due_at && Date.parse(item.due_at) <= Date.now());
  const conversations = readJsonlSync(config.file.conversations, 40);
  const openTodos = todos.filter((item) => !item.done);
  const campaigns = (() => { try { return require('../business/campaigns').list(); } catch { return []; } })();
  const pipeline = (() => { try { return require('../business/crm').pipeline(); } catch { return null; } })();
  const recentFacts = store.list({ limit: 8 });
  return { stats, openTodos, due, campaigns, pipeline, recentFacts, conversations };
}
function digest(options = {}) {
  const data = collect();
  const now = new Date().toLocaleDateString('mk-MK', { timeZone: config.automation.timezone });
  const lines = [];
  lines.push('\u0414\u043d\u0435\u0432\u0435\u043d \u043f\u0440\u0435\u0433\u043b\u0435\u0434 \u2014 ' + now);
  lines.push('\u041c\u0435\u043c\u043e\u0440\u0438\u0458\u0430: ' + data.stats.facts + ' \u0444\u0430\u043a\u0442\u0438, ' + data.stats.graph.entities + ' \u0435\u043d\u0442\u0438\u0442\u0435\u0442\u0438, ' + data.stats.graph.relationships + ' \u0432\u0440\u0441\u043a\u0438');
  lines.push('\u0417\u0430\u0434\u0430\u0447\u0438: ' + data.openTodos.length + ' \u043e\u0442\u0432\u043e\u0440\u0435\u043d\u0438' + (data.due.length ? ', ' + data.due.length + ' \u0434\u043e\u0441\u0442\u0430\u043f\u043d\u0438' : ''));
  if (data.campaigns.length) lines.push('\u041a\u0430\u043c\u043f\u0430\u045a\u0438: ' + data.campaigns.map((campaign) => campaign.name + ' (' + campaign.status + ')').join(', '));
  if (data.pipeline) lines.push('CRM: ' + data.pipeline.total + ' \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0438, \u0432\u043e \u0444\u0430\u0437\u0430 won: ' + (data.pipeline.by_stage.won || 0));
  if (data.recentFacts.length) lines.push('\u041d\u043e\u0432\u043e \u0437\u043d\u0430\u0435\u045a\u0435: ' + data.recentFacts.slice(0, 3).map((fact) => fact.text.slice(0, 80)).join(' | '));
  return { title: options.title || 'Daily digest', date: now, text: lines.join('\n'), data: { facts: data.stats.facts, open_todos: data.openTodos.length, due_todos: data.due.length, campaigns: data.campaigns.length, contacts: data.pipeline ? data.pipeline.total : 0 } };
}
function morningBrief() {
  const data = collect();
  const lines = ['\u0414\u043e\u0431\u0440\u043e \u0443\u0442\u0440\u043e. \u041f\u043b\u0430\u043d \u0437\u0430 \u0434\u0435\u043d\u0435\u0441:'];
  if (data.due.length) lines.push('\u0414\u043e\u0441\u0442\u0430\u043f\u043d\u0438: ' + data.due.map((item) => item.text).join('; '));
  if (data.openTodos.length) lines.push('\u041e\u0442\u0432\u043e\u0440\u0435\u043d\u0438 \u0437\u0430\u0434\u0430\u0447\u0438: ' + data.openTodos.slice(0, 5).map((item) => item.text).join('; '));
  const last = readJsonlSync(config.file.journal, 3);
  if (last.length) lines.push('\u041e\u0434 \u0434\u043d\u0435\u0432\u043d\u0438\u043a\u043e\u0442: ' + last.map((row) => String(row.text).slice(0, 60)).join(' | '));
  return { title: 'Morning brief', text: lines.join('\n') };
}
function eveningReview() {
  const data = collect();
  const today = new Date().toISOString().slice(0, 10);
  const doneToday = data.openTodos.length ? [] : [];
  const lines = ['\u041a\u0440\u0430\u0458 \u043d\u0430 \u0434\u0435\u043d\u043e\u0442 \u2014 ' + today];
  lines.push('\u0417\u0430\u0432\u0440\u0448\u0435\u043d\u0438 \u0437\u0430\u0434\u0430\u0447\u0438 \u0434\u0435\u043d\u0435\u0441: ' + (data.stats.facts ? '' : '') + doneToday.length);
  lines.push('\u041d\u043e\u0432\u0438 \u0444\u0430\u043a\u0442\u0438: ' + data.recentFacts.length);
  const reflections = readJsonlSync(config.file.learned, 5).filter((row) => row.type === 'reflection');
  if (reflections.length) lines.push('\u041d\u0430\u0443\u0447\u0435\u043d\u043e: ' + reflections.map((row) => (row.lessons || [])[0] || '').filter(Boolean).slice(0, 2).join(' | '));
  return { title: 'Evening review', text: lines.join('\n') };
}
function actions() {
  return [
    { name: 'daily_digest', category: 'automation', description: '\u0414\u043d\u0435\u0432\u0435\u043d \u0438\u0437\u0432\u0435\u0448\u0442\u0430\u0458', params: {}, handler: async () => digest() },
    { name: 'morning_brief', category: 'automation', description: '\u0423\u0442\u0440\u0438\u043d\u0441\u043a\u0438 \u043f\u043b\u0430\u043d', params: {}, handler: async () => morningBrief() },
    { name: 'evening_review', category: 'automation', description: '\u0412\u0435\u0447\u0435\u0440\u0435\u043d \u043f\u0440\u0435\u0433\u043b\u0435\u0434', params: {}, handler: async () => eveningReview() },
  ];
}
module.exports = { digest, morningBrief, eveningReview, actions };
