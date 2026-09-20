'use strict';
const path = require('node:path');
const config = require('../lib/config').load();
const logger = require('../lib/logger');
const BANNER = 'HUGO v' + config.version + ' \u2014 \u043b\u043e\u043a\u0430\u043b\u0435\u043d \u043c\u043e\u0437\u043e\u043a \u0431\u0435\u0437 \u043a\u043b\u0443\u0447\u0435\u0432\u0438';
function print(value) { console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2)); }
async function main(argv) {
  const command = argv[0] || 'start';
  const args = argv.slice(1);
  logger.configure({ file: config.file.log, level: config.logging.level });
  const store = require('../memory/store');
  const tools = require('../tools/registry');
  const runtime = require('../core/runtime');
  if (command === 'capabilities') { print(require('../core/capabilities').report()); return; }
  if (command === 'doctor' || command === 'env:check') {
    const report = config.validate ? require('../lib/config').validate() : { ok: true };
    const env = require('../lib/config').describeEnv();
    print({ version: config.version, root: config.root, config: report, env, capabilities: require('../core/capabilities').report().items });
    if (args.includes('--json')) return;
    console.log('\n' + BANNER + '\n' + (report.ok ? 'config ok' : 'config problems: ' + report.errors.join('; ')));
    return;
  }
  if (command === 'start') {
    store.ensureStorage();
    console.log(BANNER);
    const caps = require('../core/capabilities').report();
    caps.items.forEach((item) => console.log((item.available ? '[x] ' : '[ ] ') + item.name + ': ' + item.detail));
    const chrome = require('../eyes/chrome').detect();
    if (!chrome.reachable && !args.includes('--no-browser')) console.log('\nbrowser: not connected \u2014 run "npm run chrome" once to use your logins');
    require('../automation/scheduler').start();
    require('../automation/reminders').start();
    const ui = require('../ui/server').start();
    let gateway = null;
    if (process.env[config.gateway.token_env]) gateway = require('../gateway/server').start();
    console.log('\nUI: http://' + config.ui.host + ':' + config.ui.port + '/?token=<' + config.ui.token_env + '>');
    console.log('Ctrl+C to stop.');
    const shutdown = () => { require('../automation/scheduler').stop(); require('../automation/reminders').stop(); ui.close(); if (gateway) gateway.close(); process.exit(0); };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    return;
  }
  if (command === 'ui') { require('../ui/server').start(); return; }
  if (command === 'gateway') { require('../gateway/server').start(); return; }
  if (command === 'chrome:launch') { print(require('../eyes/chrome').launch({ fresh: args.includes('--fresh') })); return; }
  if (command === 'chat') { const text = args.join(' ') || 'help'; print((await runtime.chat(text)).reply); return; }
  if (command === 'goal') { print(await runtime.goal(args.join(' '))); return; }
  if (command === 'run') {
    const action = args[0];
    let input = {};
    try { input = args[1] ? JSON.parse(args[1]) : {}; } catch (error) { print({ ok: false, error: 'input must be JSON: ' + error.message }); return; }
    print(await runtime.run(action, input));
    return;
  }
  if (command === 'tools') { print(tools.list({ category: args[0] })); return; }
  if (command === 'tools:audit') { const report = tools.audit(); print({ counts: report.counts, by_category: report.by_category, written_to: 'data/tools-status.json' }); return; }
  if (command === 'agents') {
    const agents = require('../agents/registry');
    if (args[0] === 'route') { print(agents.route(args.slice(1).join(' '), { limit: 5 }).map((agent) => ({ id: agent.id, name: agent.name, category: agent.category }))); return; }
    if (args[0] === 'run') { print(await agents.run(agents.route(args.slice(1).join(' '), { limit: 1 })[0], args.slice(1).join(' '))); return; }
    if (args[0] === 'orchestrate') { print(await agents.orchestrate(args.slice(1).join(' '))); return; }
    print(agents.stats());
    return;
  }
  if (command === 'memory:recall') { print(store.recall(args.join(' '), { limit: 10 })); return; }
  if (command === 'memory:stats') { print(store.stats()); return; }
  if (command === 'memory:export') { print(require('../automation/memorysync').exportTo(args[0])); return; }
  if (command === 'memory:import') { print(await require('../automation/memorysync').importFrom(args[0])); return; }
  if (command === 'memory:sync') { print(require('../automation/memorysync').syncOnce({ push: !args.includes('--no-push') })); return; }
  if (command === 'memory:prune') { print(store.enforceRetention(args[0] ? Number(args[0]) : null)); return; }
  if (command === 'memory:ingest') { print(await require('../memory/conversations').ingest({ all: true })); return; }
  if (command === 'digest') { print(require('../automation/digest').digest()); return; }
  if (command === 'brief') { print(require('../automation/digest').morningBrief()); return; }
  if (command === 'review') { print(require('../automation/digest').eveningReview()); return; }
  if (command === 'autolearn') { print(await require('../automation/autolearn').run({ limit: args[0] ? Number(args[0]) : undefined })); return; }
  if (command === 'secrets:scan') { print({ findings: require('../automation/memorysync').scanSecrets(require('../lib/fsx').listFiles(config.dir.memory).map((name) => path.join(config.dir.memory, name))) }); return; }
  if (command === 'campaigns') { print(require('../business/campaigns').list()); return; }
  if (command === 'crm') { print(require('../business/crm').pipeline()); return; }
  if (command === 'test') { require('../tests/run-all'); return; }
  if (command === 'host') { print(require('../tools/impl/hosttools').tools.host_report.run({ refresh: args.includes('--refresh') })); return; }
  if (command === 'sh' || command === 'host:shell') { const host = require('../host/host'); print(args.length ? host.shell(args.join(' ')) : host.detect()); return; }
  if (command === 'wsl') { const host = require('../host/host'); print(args[0] === 'list' || !args.length ? host.wslList() : host.wslRun(args[0] === '--distro' ? args[1] : null, (args[0] === '--distro' ? args.slice(2) : args).join(' '))); return; }
  if (command === 'wsl:info') { print(require('../host/host').wslInfo(args[0])); return; }
  if (command === 'files') { const f = require('../tools/impl/files').tools; print(args[0] === 'tree' ? f.file_tree.run({ path: args[1] || '.' }) : f.file_list.run({ path: args.join(' ') || '.' })); return; }
  if (command === 'confirm') {
    const c = require('../lib/confirm');
    if (args[0] === 'approve') print(c.approve(args[1] || c.pending()[0]?.id));
    else if (args[0] === 'deny') print(c.deny(args[1]));
    else print(c.pending(args[0]));
    return;
  }
  if (command === 'registry:sync') { print(require('../tools/sync').sync()); return; }
  if (command === 'registry:check') { print(require('../tools/sync').check()); return; }
  if (command === 'sites') { print({ facebook: ['fb_open', 'fb_feed_read', 'fb_write_post', 'fb_publish', 'fb_search'], youtube: ['yt_open', 'yt_search', 'yt_play', 'yt_pause', 'yt_resume', 'yt_next', 'yt_volume', 'yt_now_playing'] }); return; }
  if (command === 'exec' || command === 'jarvis') { print(await runtime.goal(args.join(' '))); return; }
  if (command === 'chrome:attach') { print(await require('../eyes/chrome').ensure({})); return; }
  if (command === 'vision') { print(await require('../eyes/vision').describePage({ url: args[0] })); return; }
  console.log('unknown command: ' + command);
  console.log('commands: start, doctor, capabilities, chat, goal, exec (natural command), run, host, sh, wsl, files, confirm, registry:sync, registry:check, sites, vision, tools, tools:audit, agents, memory:*, digest, brief, review, autolearn, secrets:scan, campaigns, crm, ui, gateway, chrome:launch, chrome:attach, env:check');
}
if (require.main === module) main(process.argv.slice(2)).catch((error) => { console.error('HUGO error: ' + error.message); process.exitCode = 1; });
module.exports = { main };
