'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hugo-test-'));
const targets = ['memory', '.hugo', 'logs'];
const snapshots = new Map();
const fileTargets = ['data/tools-status.json'];
const tests = [];
const live = process.argv.includes('--live');

function snapshot() {
  for (const rel of targets) {
    const src = path.join(ROOT, rel);
    const dst = path.join(tmp, rel);
    if (fs.existsSync(src)) { fs.cpSync(src, dst, { recursive: true }); snapshots.set(rel, true); }
  }
  for (const rel of fileTargets) {
    const src = path.join(ROOT, rel);
    if (fs.existsSync(src)) { fs.cpSync(src, path.join(tmp, rel), { recursive: true }); snapshots.set(rel, true); }
  }
}
function restore() {
  for (const rel of [...targets, ...fileTargets]) {
    const src = path.join(ROOT, rel);
    const backup = path.join(tmp, rel);
    fs.rmSync(src, { recursive: true, force: true });
    if (snapshots.has(rel) && fs.existsSync(backup)) {
      fs.mkdirSync(path.dirname(src), { recursive: true });
      fs.cpSync(backup, src, { recursive: true });
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
function add(name, fn) { tests.push({ name, fn }); }
async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { status: response.status, body };
}

snapshot();

const config = require('../lib/config');
const cfg = config.load();
const { parse, wake, reminderArgs } = require('../cognition/commands');
const tools = require('../tools/registry');
const actions = require('../core/actions');
const store = require('../memory/store');
const productivity = require('../tools/impl/productivity');
const scheduler = require('../automation/scheduler');
const reminders = require('../automation/reminders');
const runtime = require('../core/runtime');
const reasoner = require('../cognition/reasoner');
const planner = require('../cognition/planner');
const capabilities = require('../core/capabilities');
const voice = require('../voice/speech');
const chrome = require('../eyes/chrome');
const agents = require('../agents/registry');
const integrations = require('../integrations/registry');
const mcp = require('../integrations/mcp');
const business = require('../business/crm');
const campaigns = require('../business/campaigns');
const digest = require('../automation/digest');
const memorysync = require('../automation/memorysync');

add('config loads', () => assert.ok(cfg));
add('config version is 7.0.0', () => assert.equal(cfg.version, '7.0.0'));
add('config name is HUGO', () => assert.equal(cfg.name, 'HUGO'));
add('config root exists', () => assert.ok(fs.existsSync(cfg.root)));
add('required catalog exists', () => assert.ok(fs.existsSync(cfg.file.toolsCatalog)));
add('agent catalog exists', () => assert.ok(fs.existsSync(cfg.file.agents)));
add('intents catalog exists', () => assert.ok(fs.existsSync(cfg.file.intents)));
add('timezone is Skopje', () => assert.equal(cfg.automation.timezone, 'Europe/Skopje'));
add('browser port valid', () => assert.ok(Number.isInteger(cfg.browser.port) && cfg.browser.port > 0 && cfg.browser.port < 65536));
add('ui port valid', () => assert.ok(Number.isInteger(cfg.ui.port) && cfg.ui.port > 0 && cfg.ui.port < 65536));
add('gateway port valid', () => assert.ok(Number.isInteger(cfg.gateway.port) && cfg.gateway.port > 0 && cfg.gateway.port < 65536));
add('envBool true', () => { const old = process.env.HUGO_TEST_BOOL; process.env.HUGO_TEST_BOOL = 'yes'; try { assert.equal(config.envBool('HUGO_TEST_BOOL', false), true); } finally { old === undefined ? delete process.env.HUGO_TEST_BOOL : process.env.HUGO_TEST_BOOL = old; } });
add('envBool false', () => { const old = process.env.HUGO_TEST_BOOL; process.env.HUGO_TEST_BOOL = 'no'; try { assert.equal(config.envBool('HUGO_TEST_BOOL', true), false); } finally { old === undefined ? delete process.env.HUGO_TEST_BOOL : process.env.HUGO_TEST_BOOL = old; } });
add('envInt valid', () => { const old = process.env.HUGO_TEST_INT; process.env.HUGO_TEST_INT = '42'; try { assert.equal(config.envInt('HUGO_TEST_INT', 9), 42); } finally { old === undefined ? delete process.env.HUGO_TEST_INT : process.env.HUGO_TEST_INT = old; } });
add('envInt fallback', () => { const old = process.env.HUGO_TEST_INT; process.env.HUGO_TEST_INT = 'nope'; try { assert.equal(config.envInt('HUGO_TEST_INT', 9), 9); } finally { old === undefined ? delete process.env.HUGO_TEST_INT : process.env.HUGO_TEST_INT = old; } });
add('deepMerge keeps base values', () => assert.deepEqual(config.deepMerge({ a: 1, b: { c: 2 } }, { b: { d: 3 } }), { a: 1, b: { c: 2, d: 3 } }));
add('resolvePath supports strings', () => assert.equal(config.resolvePath('x.json', 'fallback'), 'x.json'));
add('resolvePath supports objects', () => assert.equal(config.resolvePath({ store: 'y.json' }, 'fallback'), 'y.json'));
add('dotenv parser works', () => { const file = path.join(tmp, 'test.env'); fs.writeFileSync(file, 'HUGO_TEST_A="hello world"\nexport HUGO_TEST_B=yes # comment\n# ignore\n'); delete process.env.HUGO_TEST_A; delete process.env.HUGO_TEST_B; const result = config.loadDotEnv(file); assert.equal(result.loaded, true); assert.equal(process.env.HUGO_TEST_A, 'hello world'); assert.equal(process.env.HUGO_TEST_B, 'yes'); delete process.env.HUGO_TEST_A; delete process.env.HUGO_TEST_B; });
add('describeEnv includes local model', () => assert.ok(config.describeEnv().some((x) => x.name === 'HUGO_LOCAL_AI_MODEL')));
add('describeEnv includes vision', () => assert.ok(config.describeEnv().some((x) => x.name === 'HUGO_VISION_ENDPOINT')));
add('config validation passes', () => assert.equal(config.validate().ok, true));

add('parse remember', () => assert.equal(parse('запомни дека работам транспорт').action, 'remember'));
add('parse recall', () => assert.equal(parse('што знаеш за транспорт').action, 'recall'));
add('parse recall with “потсети ме за”', () => assert.deepEqual(parse('потсети ме за транспорт').args, { text: 'транспорт' }));
add('parse reminder with tomorrow/time', () => { const c = parse('потсети ме утре во 10 да се јавам'); assert.equal(c.action, 'reminder_add'); assert.equal(c.args.text, 'да се јавам'); assert.ok(c.args.due_at); });
add('parse reminder at a time rolls to future', () => { const c = parse('потсетник во 10 да се јавам'); assert.equal(c.action, 'reminder_add'); assert.ok(c.args.due_at); });
add('parse todo', () => assert.deepEqual(parse('задача јави се').args, { text: 'јави се', action: 'add' }));
add('parse note saves', () => assert.deepEqual(parse('белешка тест').args, { text: 'тест', action: 'save' }));
add('wake Hugo', () => { const x = wake('Хуго, пребарај OpenAI'); assert.equal(x.woken, true); assert.equal(x.command, 'пребарај OpenAI'); });
add('wake English Hugo', () => { const x = wake('hugo, open https://example.com'); assert.equal(x.woken, true); assert.equal(x.command, 'open https://example.com'); });
add('wake Xugo', () => { const x = wake('xugo search test'); assert.equal(x.woken, true); assert.equal(x.command, 'search test'); });
add('wake does not trigger inside another word', () => assert.equal(wake('hugoistic test').woken, false));
add('parse open URL', () => assert.equal(parse('отвори https://example.com').args.url, 'https://example.com'));
add('parse search query', () => assert.equal(parse('пребарај OpenAI').args.query, 'OpenAI'));
add('parse weather', () => assert.equal(parse('време во Скопје').args.city, 'Скопје'));
add('parse coin price', () => assert.equal(parse('цена на BTC').args.coin.toLowerCase(), 'btc'));
add('parse news', () => assert.equal(parse('вести tech').action, 'news_bundle'));
add('parse help', () => assert.equal(parse('помош').action, 'help'));
add('reminder text parser strips date/time', () => assert.equal(reminderArgs('утре во 18:30 испрати фактури').text, 'испрати фактури'));
add('reminder date is tomorrow', () => { const d = new Date(reminderArgs('утре во 18:30 испрати фактури').due_at); assert.equal(d.getUTCDate(), new Date(Date.now() + 86400000).getUTCDate()); });

add('tool registry has many tools', () => assert.ok(tools.count() > 200));
add('tool audit has real tools', () => assert.ok(tools.audit().counts.real >= 100));
add('QR tool is real', () => assert.equal(tools.statusOf(tools.get('qr_code')), 'real'));
add('coin price tool is real', () => assert.equal(tools.statusOf(tools.get('coin_price')), 'real'));
add('weather tool is real', () => assert.equal(tools.statusOf(tools.get('current_weather')), 'real'));
add('summarize tool is real', () => assert.equal(tools.statusOf(tools.get('summarize')), 'real'));
add('planned image tool stays clearly unsupported', async () => { await assert.rejects(() => tools.call('generate_image', { q: 'test' }), (e) => e.code === 'HUGO_UNSUPPORTED'); });
add('coin price is exposed as a runtime action', () => assert.ok(actions.find('coin_price')));
add('weather is exposed as a runtime action', () => assert.ok(actions.find('current_weather')));
add('news is exposed as a runtime action', () => assert.ok(actions.find('news_bundle')));
add('summarize is exposed as a runtime action', () => assert.ok(actions.find('summarize')));
add('translate is exposed as a runtime action', () => assert.ok(actions.find('translate')));
add('productivity actions are exposed', () => ['todo','note','reminder_add','pomodoro','habit','journal','kanban','mood_tracker'].forEach((x) => assert.ok(actions.find(x))));
add('agent actions are exposed', () => assert.ok(actions.find('agent_route')));
add('business actions are exposed', () => assert.ok(actions.find('crm_pipeline')));

store.ensureStorage();
const factText = 'HUGO_TEST_FACT_2026 transporte';
let testFactId;
add('memory storage exists', () => assert.ok(fs.existsSync(cfg.file.facts)));
add('memory learn works', async () => { const r = await store.learn(factText, { source: 'test', tags: ['test'] }); testFactId = r.fact.id; assert.ok(testFactId); });
add('memory recall finds fact', () => assert.ok(store.recall('HUGO_TEST_FACT_2026').hits.some((x) => x.id === testFactId)));
add('memory context contains fact', () => assert.match(store.context('HUGO_TEST_FACT_2026').text, /HUGO_TEST_FACT_2026/));
add('memory dedupe updates fact', async () => { const r = await store.learn(factText, { source: 'test', tags: ['test2'] }); assert.equal(r.updated, true); });
add('memory list works', () => assert.ok(store.list({ limit: 100 }).some((x) => x.id === testFactId)));
add('memory get works', () => assert.equal(store.get(testFactId).id, testFactId));
add('memory update works', async () => { const r = await store.update(testFactId, { text: 'HUGO_TEST_FACT_2026 updated' }); assert.equal(r.fact.id, testFactId); });
add('memory export works', () => { const r = store.exportBundle(); assert.ok(r.files && r.files.facts); });
add('memory stats works', () => assert.ok(store.stats().facts >= 1));
add('memory rebuild indexes works', () => assert.ok(store.rebuildIndexes().facts >= 1));
add('memory forget works', () => { const r = store.forget(testFactId); assert.equal(r.forgotten, true); assert.equal(store.get(testFactId), null); });

add('todo add works', async () => { const r = await productivity.tools.todo.run({ action: 'add', text: 'HUGO_TEST_TODO' }); assert.equal(r.added.text, 'HUGO_TEST_TODO'); });
add('todo list works', async () => { const r = await productivity.tools.todo.run({ action: 'list' }); assert.ok(r.open.some((x) => x.text === 'HUGO_TEST_TODO')); });
let todoId;
add('todo done works', async () => { const list = await productivity.tools.todo.run({ action: 'list' }); todoId = list.open.find((x) => x.text === 'HUGO_TEST_TODO').id; const r = await productivity.tools.todo.run({ action: 'done', id: todoId }); assert.equal(r.done.done, true); });
add('todo remove works', async () => { const r = await productivity.tools.todo.run({ action: 'remove', id: todoId }); assert.equal(r.removed, 1); });
add('note save/get works', async () => { await productivity.tools.note.run({ action: 'save', title: 'HUGO_TEST_NOTE', text: 'hello' }); const r = await productivity.tools.note.run({ action: 'get', title: 'HUGO_TEST_NOTE' }); assert.equal(r.text, 'hello'); });
add('reminder add works', async () => { const r = await productivity.tools.reminder_add.run({ text: 'HUGO_TEST_REMINDER', due_at: new Date(Date.now() - 1000).toISOString() }); assert.equal(r.reminder.text, 'HUGO_TEST_REMINDER'); });
add('pomodoro start works', async () => { const r = await productivity.tools.pomodoro.run({ action: 'start', minutes: 1 }); assert.equal(r.started, true); });
add('pomodoro status works', async () => { const r = await productivity.tools.pomodoro.run({ action: 'status' }); assert.equal(r.running, true); });
add('pomodoro stop works', async () => { const r = await productivity.tools.pomodoro.run({ action: 'stop' }); assert.equal(r.stopped, true); });
add('habit check works', async () => { const r = await productivity.tools.habit.run({ action: 'check', name: 'HUGO_TEST_HABIT' }); assert.equal(r.habit, 'HUGO_TEST_HABIT'); });
add('habit list works', async () => { const r = await productivity.tools.habit.run({ action: 'list' }); assert.ok(r.habits.some((x) => x.name === 'HUGO_TEST_HABIT')); });
add('journal write/read works', async () => { await productivity.tools.journal.run({ action: 'write', text: 'HUGO_TEST_JOURNAL' }); const r = await productivity.tools.journal.run({ action: 'read', limit: 50 }); assert.ok(r.entries.some((x) => x.text === 'HUGO_TEST_JOURNAL')); });
let cardId;
add('kanban add works', async () => { const r = await productivity.tools.kanban.run({ action: 'add', text: 'HUGO_TEST_CARD', column: 'todo' }); cardId = r.added.id; assert.ok(cardId); });
add('kanban move works', async () => { const r = await productivity.tools.kanban.run({ action: 'move', id: cardId, column: 'done' }); assert.equal(r.to, 'done'); });
add('kanban list works', async () => { const r = await productivity.tools.kanban.run({ action: 'list' }); assert.ok(r.board.done.some((x) => x.id === cardId)); });
add('mood tracker accepts 1-5', async () => { const r = await productivity.tools.mood_tracker.run({ score: 4, note: 'HUGO_TEST_MOOD' }); assert.equal(r.logged.score, 4); });
add('mood tracker rejects 0', async () => { await assert.rejects(() => productivity.tools.mood_tracker.run({ score: 0 }), /1-5/); });

let jobId;
add('schedule add works', () => { const r = scheduler.schedule({ id: 'HUGO_TEST_JOB', action: 'memory_stats', at: new Date(Date.now() - 1000).toISOString() }); jobId = r.id; assert.equal(jobId, 'HUGO_TEST_JOB'); });
add('schedule list finds job', () => assert.ok(scheduler.list().some((x) => x.id === jobId)));
add('schedule tick runs due job', async () => { const r = await scheduler.tick(); assert.ok(r.ran >= 1); });
add('schedule cancel works', () => assert.equal(scheduler.cancel(jobId).cancelled, true));
add('reminders due finds due item', () => assert.ok(reminders.due().some((x) => x.text === 'HUGO_TEST_REMINDER')));
add('reminders run works', async () => { const r = await reminders.tick(); assert.ok(Array.isArray(r)); });
add('digest works', () => assert.ok(digest.digest().date || digest.digest().day));
add('memory backup works', () => { const file = path.join(cfg.dir.state, 'hugo-test-backup.json'); const r = memorysync.exportTo(file); assert.ok(fs.existsSync(file)); assert.ok(r.facts >= 0); });
add('autolearn sources available', () => { const r = require('../automation/autolearn').actions()[1].handler(); assert.ok(r); });
add('integration summary works', () => assert.ok(integrations.summary().total >= 10));
add('MCP list works', () => assert.ok(Array.isArray(mcp.list())));
add('CRM pipeline works', () => assert.ok(business.pipeline().by_stage && business.pipeline().events !== undefined));
add('CRM contact updates are deduplicated', async () => { const email = 'HUGO_TEST_CRM_DEDUPE@example.invalid'; await business.addContact({ name: 'HUGO CRM Test', email }); await business.addContact({ name: 'HUGO CRM Test Updated', email }); const matches = business.listContacts().filter((contact) => contact.email === email); assert.equal(matches.length, 1); assert.equal(matches[0].name, 'HUGO CRM Test Updated'); });
add('campaign list works', () => assert.ok(Array.isArray(campaigns.list())));

add('reasoner works without local AI', async () => { const r = await reasoner.reason('што е транспорт'); assert.ok(r.provider === 'local-rules' || r.provider === 'local-model'); });
add('reasoner cleans think-only model output', () => { assert.equal(reasoner.cleanModelText('<think>internal</think>Здраво'), 'Здраво'); assert.equal(reasoner.cleanModelText('<think>internal</think>', 'fallback'), 'fallback'); });
add('reasoner routes a weather query', () => assert.equal(reasoner.routeIntent('време во Скопје', { limit: 1 })[0].tool, 'current_weather'));
add('planner creates steps', () => { const p = planner.decompose('запомни дека HUGO_TEST_PLAN'); assert.ok(p.steps.length >= 1); });
add('planner picks executable tools', () => { const p = planner.decompose('цена на BTC'); const step = p.steps.find((x) => x.kind === 'tool'); assert.ok(step); assert.equal(step.action, 'coin_price'); });
add('planner avoids an unimplemented planned tool', () => { const p = planner.decompose('направи слика на куче'); const step = p.steps.find((x) => x.id !== 'step-1' || !p.steps.some((y) => y.id === 'step-1')); assert.ok(p.steps.every((x) => x.action !== 'generate_image')); });
add('planner progress works', () => { const p = planner.decompose('запомни HUGO_TEST_PROGRESS'); p.steps[0].status = 'done'; const r = planner.progress(p); assert.equal(r.done, 1); });
add('runtime unknown action returns clean error', async () => { const r = await runtime.run('definitely_not_real'); assert.equal(r.ok, false); assert.equal(r.error.code, 'HUGO_NOT_FOUND'); });
add('runtime memory stats action works', async () => { const r = await runtime.run('memory_stats'); assert.equal(r.ok, true); });
add('runtime chat help works', async () => { const r = await runtime.chat('помош'); assert.match(r.reply, /Се вкупно/); });
add('runtime chat remember works', async () => { const r = await runtime.chat('запомни HUGO_TEST_CHAT_MEMORY'); assert.equal(r.action, 'remember'); assert.equal(r.result.ok, true); });
add('runtime chat recall works', async () => { const r = await runtime.chat('што знаеш за HUGO_TEST_CHAT_MEMORY'); assert.equal(r.action, 'recall'); assert.equal(r.result.ok, true); assert.match(r.reply, /HUGO_TEST_CHAT_MEMORY/); });
add('runtime chat todo works', async () => { const r = await runtime.chat('задача HUGO_TEST_CHAT_TODO'); assert.equal(r.result.ok, true); assert.match(r.reply, /HUGO_TEST_CHAT_TODO/); });
add('runtime chat note works', async () => { const r = await runtime.chat('белешка HUGO_TEST_CHAT_NOTE'); assert.equal(r.result.ok, true); assert.match(r.reply, /HUGO_TEST_CHAT_NOTE/); });
add('runtime chat reminder works', async () => { const r = await runtime.chat('потсети ме утре во 10 HUGO_TEST_CHAT_REMINDER'); assert.equal(r.result.ok, true); assert.equal(r.result.result.reminder.due_at !== null, true); assert.match(r.reply, /HUGO_TEST_CHAT_REMINDER/); });
add('evening review counts completed todos today', async () => { const task = await productivity.tools.todo.run({ action: 'add', text: 'HUGO_TEST_EVENING_DONE' }); await productivity.tools.todo.run({ action: 'done', id: task.added.id }); assert.match(digest.eveningReview().text, /Завршени задачи денес: 1/); });
add('voice languages work', () => assert.ok(voice.languages().includes('mk-MK')));
add('voice wake helper works', () => assert.equal(voice.wakeWord('hugo help').woken, true));
add('browser detect is safe', () => assert.doesNotThrow(() => chrome.detect()));
add('capabilities report works', () => { const r = capabilities.report(); assert.ok(r.items && r.actions.total >= 180); });
add('agent stats work', () => assert.ok(agents.stats().total >= 4800));
add('agent route works', () => assert.ok(agents.route('crypto bitcoin', { limit: 1 })[0]));
add('UI page contains HUGO', () => assert.match(require('../ui/server').page(), /HUGO/));

if (live) {
  add('LIVE coin price fetch', async () => { const r = await tools.call('coin_price', { coin: 'btc' }); assert.ok(r); });
  add('LIVE weather fetch', async () => { const r = await tools.call('current_weather', { city: 'Skopje' }); assert.ok(r); });
  add('LIVE Hacker News fetch', async () => { const r = await tools.call('hackernews', {}); assert.ok(r); });
}

async function run() {
  let passed = 0;
  let failed = 0;
  try {
    for (const item of tests) {
      try { await item.fn(); console.log('PASS ' + item.name); passed += 1; }
      catch (error) { console.error('FAIL ' + item.name + ': ' + error.message); failed += 1; }
    }
  } finally {
    try { scheduler.stop(); reminders.stop(); } catch {}
    restore();
  }
  console.log(`\nHUGO tests: ${passed}/${tests.length} passed${failed ? `, ${failed} failed` : ''}.`);
  process.exitCode = failed ? 1 : 0;
}
run().catch((error) => { try { scheduler.stop(); reminders.stop(); } catch {} restore(); console.error(error); process.exitCode = 1; });
