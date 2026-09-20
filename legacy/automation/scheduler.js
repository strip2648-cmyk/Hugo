'use strict';
const { readJsonSync, writeJsonSync } = require('../lib/fsx');
const { shortId } = require('../lib/ids');
const { InputError } = require('../lib/errors');
const logger = require('../lib/logger').createLogger('scheduler');
const config = require('../lib/config').load();
let timer = null;
function load() { const data = readJsonSync(config.file.schedules, { jobs: [] }); return Array.isArray(data) ? { jobs: data } : data; }
function save(data) { return writeJsonSync(config.file.schedules, data); }
function list() { return load().jobs || []; }
function schedule(input = {}) {
  const action = input.action || input.command;
  if (!action) throw new InputError('action is required');
  if (!input.every_ms && !input.at) throw new InputError('every_ms (interval) or at (ISO time) is required');
  const job = {
    id: input.id || shortId('job'), action, args: input.args || {},
    every_ms: input.every_ms ? Math.max(5000, Number(input.every_ms)) : null,
    at: input.at || null, label: input.label || action,
    created_at: new Date().toISOString(), runs: 0, last_run: null, last_result: null,
  };
  const data = load();
  data.jobs = (data.jobs || []).filter((entry) => entry.id !== job.id).concat(job);
  save(data);
  return job;
}
function cancel(id) {
  const data = load();
  const before = (data.jobs || []).length;
  data.jobs = (data.jobs || []).filter((job) => job.id !== id);
  save(data);
  return { cancelled: before !== data.jobs.length, id };
}
async function tick() {
  const runtime = require('../core/runtime');
  const now = Date.now();
  const data = load();
  let changes = 0;
  for (const job of data.jobs || []) {
    const dueByInterval = job.every_ms && (!job.last_run || now - Date.parse(job.last_run) >= job.every_ms);
    const dueByTime = job.at && Date.parse(job.at) <= now && !job.fired;
    if (!dueByInterval && !dueByTime) continue;
    const attempts = Math.max(1, Number(job.max_attempts || (config.jobs && config.jobs.max_attempts) || 1));
    let result = null; let tries = 0; let verified = false;
    while (tries < attempts) {
      tries += 1;
      result = await runtime.run(job.action, job.args || {}, { session: 'scheduler', log: false });
      verified = Boolean(result.ok) && !(result.result && result.result.verified === false);
      if (verified || tries >= attempts) break;
      await new Promise((resolve) => setTimeout(resolve, Number((config.jobs && config.jobs.backoff_ms) || 2000) * tries));
    }
    job.runs = (job.runs || 0) + 1;
    job.tries = tries;
    job.last_run = new Date().toISOString();
    job.last_result = { ok: verified, tries, verified, summary: verified ? 'ok' : (result && result.error ? result.error.message : 'не е потврдено') };
    if (dueByTime) job.fired = true;
    changes += 1;
  }
  if (changes) save(data);
  return { ran: changes };
}
function start() {
  if (timer) return false;
  tick().catch((error) => logger.error('initial tick failed: ' + error.message));
  timer = setInterval(() => { tick().catch((error) => logger.error('tick failed: ' + error.message)); }, config.automation.tick_ms);
  return true;
}
function stop() { if (timer) { clearInterval(timer); timer = null; return true; } return false; }
function actions() {
  return [
    { name: 'schedule_add', category: 'automation', description: '\u0417\u0430\u043a\u0430\u0436\u0438 \u0437\u0430\u0434\u0430\u0447\u0430 \u043d\u0430 \u0440\u0430\u0441\u043f\u043e\u0440\u0435\u0434', params: { action: 'string', every_ms: 'number', at: 'ISO' }, handler: async (input) => schedule(input) },
    { name: 'schedule_list', category: 'automation', description: '\u041b\u0438\u0441\u0442\u0430 \u0437\u0430\u043a\u0430\u0436\u0430\u043d\u0438 \u0437\u0430\u0434\u0430\u0447\u0438', params: {}, handler: async () => list() },
    { name: 'schedule_cancel', category: 'automation', description: '\u041e\u0442\u043a\u0430\u0436\u0438 \u0437\u0430\u0434\u0430\u0447\u0430', params: { id: 'string' }, handler: async (input) => cancel(input.id) },
    { name: 'schedule_tick', category: 'automation', description: '\u041f\u0440\u043e\u0432\u0435\u0440\u0438 \u0438 \u0438\u0437\u0432\u0440\u0448\u0438 \u0448\u0442\u043e \u0435 \u0434\u043e\u0441\u0442\u0430\u043f\u043d\u043e', params: {}, handler: async () => tick() },
  ];
}
module.exports = { schedule, list, cancel, tick, start, stop, actions, load, save };
