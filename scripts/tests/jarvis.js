'use strict';

/* HUGO v7 self-tests: real files, real host control, real routing, real verification. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hugo-jarvis-'));
const snapshots = new Map();
const tests = [];
function add(name, fn) { tests.push({ name, fn }); }
function snapshot() {
  for (const rel of ['memory', '.hugo', 'logs', 'data/tools-status.json', 'data/tools-full.json', 'data/intents.json']) {
    const src = path.join(ROOT, rel);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(tmpRoot, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.cpSync(src, dst, { recursive: true });
    snapshots.set(rel, true);
  }
}
function restore() {
  for (const rel of snapshots.keys()) {
    const src = path.join(ROOT, rel);
    const backup = path.join(tmpRoot, rel);
    fs.rmSync(src, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(src), { recursive: true });
    fs.cpSync(backup, src, { recursive: true });
  }
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
snapshot();
const config = require('../lib/config').load();
const host = require('../host/host');
const files = require('../tools/impl/files').tools;
const registry = require('../tools/registry');
const sync = require('../tools/sync');
const confirm = require('../lib/confirm');
const router = require('../cognition/router');
const planner = require('../cognition/planner');
const loop = require('../cognition/loop');
const runtime = require('../core/runtime');
const actions = require('../core/actions');
const voice = require('../voice/speech');
const work = path.join(tmpRoot, 'work');
fs.mkdirSync(work, { recursive: true });

add('config version is 7.0.0', () => assert.equal(config.version, '7.0.0'));
add('host detection works', () => { const d = host.detect({ refresh: true }); assert.ok(d.kind); assert.ok(typeof d.summary === 'string'); });
add('host knows chrome + wsl state', () => { const d = host.detect(); assert.ok('chrome' in d); assert.ok('wsl' in d); });
add('windows path maps to wsl', () => assert.equal(host.toWslPath('C:\\Users\\stefan\\Desktop'), '/mnt/c/Users/stefan/Desktop'));
add('wsl path maps back to windows', () => assert.equal(host.toWindowsPath('/mnt/c/Users/stefan/Desktop'), 'C:\\Users\\stefan\\Desktop'));
add('path resolve + deny guard works', () => { const resolved = host.resolvePath('./x.txt', { base: work }); assert.ok(resolved.startsWith(work)); assert.throws(() => host.assertAllowed('/etc/shadow')); });
add('destructive command is blocked without confirm', () => assert.throws(() => host.shell('rm -rf /'), (e) => e.code === 'HUGO_BLOCKED'));

add('file_write creates and verifies', async () => { const r = await files.file_write.run({ path: path.join(work, 'test.txt'), content: 'Hello' }); assert.equal(r.verified, true); assert.ok(fs.existsSync(r.path)); });
add('file_read returns the content', async () => { const r = await files.file_read.run({ path: path.join(work, 'test.txt') }); assert.equal(r.content, 'Hello'); });
add('file_append adds a line', async () => { await files.file_append.run({ path: path.join(work, 'test.txt'), content: '\nWorld' }); const r = await files.file_read.run({ path: path.join(work, 'test.txt') }); assert.match(r.content, /Hello[\s\S]*World/); });
add('file_edit replaces text', async () => { const r = await files.file_edit.run({ path: path.join(work, 'test.txt'), find: 'World', replace: 'HUGO' }); assert.equal(r.replaced, 1); assert.equal(r.verified, true); });
add('file_list sees the file', async () => { const r = await files.file_list.run({ path: work }); assert.ok(r.files.some((f) => f.name === 'test.txt')); });
add('file_search finds by content', async () => { const r = await files.file_search.run({ path: work, content_pattern: 'HUGO' }); assert.ok(r.total >= 1); });
add('file_copy works', async () => { const r = await files.file_copy.run({ from: path.join(work, 'test.txt'), to: path.join(work, 'copy.txt') }); assert.equal(r.verified, true); });
add('file_move works', async () => { const r = await files.file_move.run({ from: path.join(work, 'copy.txt'), to: path.join(work, 'moved.txt') }); assert.equal(r.verified, true); });
add('file_mkdir works', async () => { const r = await files.file_mkdir.run({ path: path.join(work, 'nested/deep') }); assert.equal(r.verified, true); });
add('file_stat + file_hash work', async () => { const s = await files.file_stat.run({ path: path.join(work, 'test.txt') }); assert.equal(s.exists, true); const h = await files.file_hash.run({ path: path.join(work, 'test.txt') }); assert.equal(h.sha256.length, 64); });
add('file_delete without confirm asks first', async () => { const r = await files.file_delete.run({ path: path.join(work, 'moved.txt'), permanent: true }); assert.equal(r.needs_confirmation, true); });
add('file_delete with confirm removes', async () => { const r = await files.file_delete.run({ path: path.join(work, 'moved.txt'), permanent: true, confirm: true }); assert.equal(r.verified, true); });
add('file_delete goes to trash by default', async () => { const r = await files.file_delete.run({ path: path.join(work, 'test.txt') }); assert.equal(r.recoverable, true); assert.equal(r.verified, true); });
add('path_resolve reports windows + wsl mapping', async () => { const r = await files.path_resolve.run({ path: work }); assert.ok(r.windows_path || r.wsl_path); });

add('router: "Направи test.txt со Hello"', () => { const hit = router.routeStep('Направи test.txt со Hello'); assert.equal(hit.action, 'file_write'); assert.equal(hit.args.path, 'test.txt'); assert.equal(hit.args.content, 'Hello'); });
add('router: "Отвори Facebook"', () => assert.equal(router.routeStep('Отвори Facebook').action, 'fb_open'));
add('router: short site aliases choose real/browser actions', () => {
  assert.equal(router.routeStep('отвори fb').action, 'fb_open');
  assert.equal(router.routeStep('отвори yt').action, 'yt_open');
  assert.deepEqual(router.routeStep('отвори google').args, { url: 'https://www.google.com/' });
});
add('planner: open-site commands keep their routed action', () => {
  for (const [goal, action] of [['отвори facebook', 'fb_open'], ['отвори fb', 'fb_open'], ['отвори google', 'browser_open'], ['отвори youtube', 'yt_open']]) {
    const step = planner.decompose(goal, { withMemory: false }).steps[0];
    assert.equal(step.action, action, `${goal} -> ${step.action || step.kind}`);
  }
});
add('router: "Објави"', () => { const hit = router.routeStep('Објави'); assert.equal(hit.action, 'fb_publish'); assert.equal(hit.args.confirm, true); });
add('router: "Отвори YouTube и пушти Imagine Dragons"', () => { const hit = router.routeStep('Отвори YouTube и пушти Imagine Dragons'); assert.equal(hit.action, 'yt_play'); assert.equal(hit.args.query, 'Imagine Dragons'); });
add('router: "Паузирај"', () => assert.equal(router.routeStep('Паузирај').action, 'yt_pause'));
add('router: sequence splits "A па B"', () => { const steps = router.route('Направи a.txt со Еден па направи b.txt со Два'); assert.equal(steps.length, 2); assert.deepEqual(steps.map((s) => s.action), ['file_write', 'file_write']); });
add('router: unknown step is blocked, not fake success', () => { const steps = router.route('сканирај го универзумот'); assert.equal(steps[0].kind, 'blocked'); });
add('planner routes real tools', () => { const plan = planner.decompose('Направи jarvis-plan.txt со План'); const step = plan.steps.find((s) => s.kind === 'tool'); assert.equal(step.action, 'file_write'); });
add('planner marks unknown steps blocked', () => { const plan = planner.decompose('измисли непозната работа'); assert.ok(!plan.steps.some((s) => s.kind === 'reason')); });
add('planner never selects planned tools', () => { const plan = planner.decompose('generate avatar'); assert.ok(!plan.steps.some((s) => s.action === 'generate_avatar')); });
add('registry exposes v7 tools', () => { for (const id of ['file_write', 'file_read', 'file_search', 'host_report', 'ps_run', 'wsl_run', 'app_open', 'fb_open', 'fb_write_post', 'fb_publish', 'yt_play', 'yt_pause']) assert.ok(registry.get(id), 'missing ' + id); });
add('audit counts include files/host/sites', () => { const audit = registry.audit(); assert.ok(audit.counts.real >= 150); assert.ok(audit.by_category.files); });
add('catalog + intents are in sync with implementations', () => { sync.sync(); const report = sync.check(); assert.equal(report.ok, true, JSON.stringify(report.problems.slice(0, 5))); });
add('runtime actions include v7 modules', () => { for (const name of ['confirm_approve', 'vision_page', 'file_write', 'fb_publish', 'yt_play']) assert.ok(actions.find(name), 'missing action ' + name); });
add('confirm gate blocks fb_publish without approval', async () => { const r = await runtime.run('fb_publish', {}); assert.equal(r.ok, true); assert.equal(r.result.needs_confirmation, true); });
add('confirm approve then publish is unlocked', async () => { const gate = confirm.request({ action: 'fb_publish', args: {} }); confirm.approve(gate.confirmation_id); const r = await confirm.ensure('fb_publish', {}); assert.equal(r.ok, true); });
add('loop: "Направи jarvis-e2e.txt со Hello" really creates the file', async () => { const target = path.join(work, 'jarvis-e2e.txt'); const result = await loop.runGoal('Направи jarvis-e2e.txt со Hello', { argsFor: () => ({ path: target, content: 'Hello' }) }); assert.equal(result.success, true, JSON.stringify(result.observations.map((o) => o.summary))); assert.equal(fs.readFileSync(target, 'utf8'), 'Hello'); });
add('loop: unknown goal is NOT a success (no false success)', async () => { const result = await loop.runGoal('сканирај го универзумот'); assert.equal(result.success, false); });
add('loop: offline Chrome is reported as failure, not success', async () => { const result = await loop.runGoal('Отвори Facebook', { maxReplans: 0 }); assert.equal(result.success, false); assert.ok(result.observations.some((o) => !o.ok)); });
add('voice has local fallback', () => { assert.equal(typeof voice.speakLocal, 'function'); assert.ok(voice.stt().engine); });
add('capabilities report lists host + files', () => { const caps = require('../core/capabilities').report(); assert.ok(caps.actions.total >= 200); assert.ok(caps.items.some((i) => i.name === 'tools')); });
add('UI has one conversation composer', () => {
  const page = require('../ui/server').page();
  for (const label of ['Прати', 'Слушај', 'Спроведи цел', 'Статус', 'Алатки']) assert.ok(!page.includes('>' + label + '<'), 'old UI control remains: ' + label);
  assert.match(page, /id="q"/);
  assert.match(page, /addEventListener\('keydown'/);
  assert.match(page, /\/api\/voice/);
});
add('long-running goals use existing todo and scheduler', async () => {
  const result = await loop.runGoal('следи ја задачата отвори facebook', { maxReplans: 0, session: 'tracking-test' });
  const todoTool = require('../tools/impl/productivity').tools.todo;
  const todos = await todoTool.run({ action: 'list' });
  const tracked = todos.open.find((item) => item.text === 'следи ја задачата отвори facebook');
  assert.ok(tracked);
  assert.ok(require('../automation/scheduler').list().some((job) => job.id === 'hugo-task-' + tracked.id));
  assert.equal(result.tracking.pending, true);
});

async function run() {
  let passed = 0; let failed = 0;
  for (const item of tests) {
    try { await item.fn(); console.log('PASS ' + item.name); passed += 1; }
    catch (error) { console.error('FAIL ' + item.name + ': ' + error.message); failed += 1; }
  }
  try { restore(); } catch {}
  console.log(`\nHUGO JARVIS tests: ${passed}/${tests.length} passed${failed ? `, ${failed} failed` : ''}.`);
  process.exitCode = failed ? 1 : 0;
}
run().catch((error) => { try { restore(); } catch {} console.error(error); process.exitCode = 1; });
