'use strict';
const { readJsonSync, readJsonlSync } = require('../lib/fsx');
const config = require('../lib/config').load();
const logger = require('../lib/logger').createLogger('reminders');
let timer = null;
const fired = new Set();
function due() {
  const data = readJsonSync(config.file.todos, { items: [] });
  const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : (Array.isArray(data.todos) ? data.todos : []));
  const now = Date.now();
  return items.filter((item) => item && item.done !== true && item.due_at && Date.parse(item.due_at) <= now);
}
async function notify(items) {
  const results = [];
  for (const item of items) {
    if (fired.has(item.id)) continue;
    fired.add(item.id);
    const text = item.text || item.id;
    try { require('../tools/registry').call('notifications', { title: 'HUGO \u043f\u043e\u0442\u0441\u0435\u0442\u043d\u0438\u043a', text }); } catch { /* notifications may be unavailable */ }
    try { await require('../voice/speech').speak('\u041f\u043e\u0442\u0441\u0435\u0442\u043d\u0438\u043a: ' + text); } catch { /* voice may be offline */ }
    results.push({ id: item.id, text, at: new Date().toISOString() });
  }
  return results;
}
async function tick() { const items = due(); return items.length ? notify(items) : []; }
function start() {
  if (timer) return false;
  tick().catch((error) => logger.error('initial reminder tick failed: ' + error.message));
  timer = setInterval(() => { tick().catch((error) => logger.error('reminder tick failed: ' + error.message)); }, config.automation.reminder_interval_ms);
  return true;
}
function stop() { if (timer) { clearInterval(timer); timer = null; return true; } return false; }
function actions() {
  return [
    { name: 'reminders_due', category: 'automation', description: '\u041a\u043e\u0438 \u043f\u043e\u0442\u0441\u0435\u0442\u043d\u0438\u0446\u0438 \u0441\u0435 \u0434\u043e\u0441\u0442\u0430\u043f\u043d\u0438', params: {}, handler: async () => due() },
    { name: 'reminders_run', category: 'automation', description: '\u0418\u0441\u043f\u0440\u0430\u0442\u0438 \u0433\u0438 \u0434\u043e\u0441\u0442\u0430\u043f\u043d\u0438\u0442\u0435 \u043f\u043e\u0442\u0441\u0435\u0442\u043d\u0438\u0446\u0438 \u0441\u0435\u0433\u0430', params: {}, handler: async () => tick() },
    { name: 'reminders_start', category: 'automation', description: '\u0421\u0442\u0430\u0440\u0442\u0443\u0432\u0430\u0458 \u043b\u043e\u043e\u043f \u0437\u0430 \u043f\u043e\u0442\u0441\u0435\u0442\u043d\u0438\u0446\u0438', params: {}, handler: async () => ({ started: start(), interval_ms: config.automation.reminder_interval_ms }) },
  ];
}
module.exports = { due, tick, notify, start, stop, actions };
