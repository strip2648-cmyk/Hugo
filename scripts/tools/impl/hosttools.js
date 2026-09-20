'use strict';

const config = require('../../lib/config').load();
const { InputError } = require('../../lib/errors');
const host = require('../../host/host');
const confirm = require('../../lib/confirm');
const tools = {
  host_report: { category: 'host', description: 'Што има на машината: Windows, WSL, Chrome, PowerShell', params: { refresh: 'boolean' }, run: async (input = {}) => host.detect({ refresh: input.refresh === true }) },
  ps_run: { category: 'host', description: 'Изврши PowerShell', params: { script: 'string', json: 'boolean' }, run: async (input = {}) => {
    const script = String(input.script || input.command || '').trim();
    if (!script) throw new InputError('script е задолжително');
    if (host.isDestructive(script).destructive && input.confirm !== true) { const gate = confirm.ensure('ps_run', input); if (!gate.ok) return gate.gate; }
    const r = input.json ? host.powershellJson(script, { timeout_ms: input.timeout_ms }) : host.powershell(script, { timeout_ms: input.timeout_ms });
    return { ok: r.ok, stdout: String(r.stdout || '').trim().slice(0, 20000), stderr: String(r.stderr || '').trim().slice(0, 4000), code: r.code, ms: r.ms, value: r.value === undefined ? null : r.value };
  } },
  cmd_run: { category: 'host', description: 'Изврши CMD команда (Windows)', params: { command: 'string' }, run: async (input = {}) => host.shell(String(input.command || ''), { kind: 'cmd', timeout_ms: input.timeout_ms, confirm: input.confirm }) },
  shell_run: { category: 'host', description: 'Изврши команда (bash/cmd) на компјутерот', params: { command: 'string', kind: 'string' }, run: async (input = {}) => {
    const command = String(input.command || '').trim();
    if (!command) throw new InputError('command е задолжително');
    if (host.isDestructive(command).destructive && input.confirm !== true) { const gate = confirm.ensure('shell_run', input); if (!gate.ok) return gate.gate; }
    const r = host.shell(command, { kind: input.kind, timeout_ms: input.timeout_ms, cwd: input.cwd, confirm: true });
    return { ok: r.ok, kind: input.kind || (process.platform === 'win32' ? 'cmd' : 'bash'), stdout: String(r.stdout || '').trim().slice(0, 20000), stderr: String(r.stderr || '').trim().slice(0, 4000), code: r.code, ms: r.ms };
  } },
  wsl_list: { category: 'host', description: 'Листа WSL дистрибуции', params: {}, run: async () => host.wslList() },
  wsl_info: { category: 'host', description: 'Информации за WSL', params: { distro: 'string' }, run: async (input = {}) => host.wslInfo(input.distro) },
  wsl_run: { category: 'host', description: 'Изврши команда во WSL', params: { distro: 'string', command: 'string' }, run: async (input = {}) => {
    const command = String(input.command || '').trim();
    if (!command) throw new InputError('command е задолжително');
    if (host.isDestructive(command).destructive && input.confirm !== true) { const gate = confirm.ensure('wsl_run', input); if (!gate.ok) return gate.gate; }
    return host.wslRun(input.distro, command, { cwd: input.cwd, timeout_ms: input.timeout_ms, confirm: true });
  } },
  wsl_read: { category: 'host', description: 'Читај фајл во WSL', params: { path: 'string' }, run: async (input = {}) => host.wslRead(input.distro, input.path, input) },
  wsl_write: { category: 'host', description: 'Пиши фајл во WSL', params: { path: 'string', content: 'string' }, run: async (input = {}) => host.wslWrite(input.distro, input.path, input.content) },
  process_list: { category: 'host', description: 'Листа процеси', params: { filter: 'string', limit: 'number' }, run: async (input = {}) => {
    if (host.detect().is_windows) return host.processes(input);
    const r = host.run('ps', ['-eo', 'pid,comm,%cpu,%mem,args', '--sort=-%mem'], { timeout_ms: 20000 });
    const lines = String(r.stdout || '').split('\n').slice(1, Number(input.limit || 40) + 1);
    return { ok: r.ok, total: lines.length, processes: lines.map((line) => ({ raw: line.trim() })), via: 'ps' };
  } },
  process_kill: { category: 'host', description: 'Затвори процес (со потврда)', params: { pid: 'number', name: 'string' }, run: async (input = {}) => {
    const targetValue = input.pid || input.name;
    if (!targetValue) throw new InputError('потребен е pid или име');
    const gate = confirm.ensure('process_kill', input);
    if (!gate.ok) return gate.gate;
    if (host.detect().is_windows) return host.killProcess(targetValue, input);
    const r = host.run('sh', ['-c', 'kill ' + (input.force === false ? '' : '-9 ') + String(targetValue).replace(/[^0-9]/g, '')], { timeout_ms: 10000 });
    return { ok: r.ok, killed: r.ok, target: String(targetValue), stderr: String(r.stderr || '').trim() };
  } },
  app_open: { category: 'host', description: 'Отвори апликација, папка или линк на компјутерот', params: { target: 'string' }, run: async (input = {}) => {
    const value = String(input.target || input.url || input.path || '').trim();
    if (!value) throw new InputError('target е задолжително');
    return host.open(value);
  } },
  app_start: { category: 'host', description: 'Стартувај апликација по име (notepad, calc...)', params: { name: 'string' }, run: async (input = {}) => host.startApp(input.name || input.target) },
  window_list: { category: 'host', description: 'Отворени прозорци', params: {}, run: async () => host.windows() },
  window_focus: { category: 'host', description: 'Донеси прозорец напред', params: { title: 'string' }, run: async (input = {}) => host.focusWindow(input.title) },
  clip_get: { category: 'host', description: 'Прочитај clipboard', params: {}, run: async () => host.clipGet() },
  clip_set: { category: 'host', description: 'Стави во clipboard', params: { text: 'string' }, run: async (input = {}) => host.clipSet(input.text) },
  screen_shot: { category: 'host', description: 'Слика од целиот екран', params: { dir: 'string' }, run: async (input = {}) => host.screenshot(input.dir ? host.expand(input.dir) : undefined) },
  volume_control: { category: 'host', description: 'Тон на компјутерот: mute / up / down', params: { action: 'string' }, run: async (input = {}) => host.volume(input) },
  media_key: { category: 'host', description: 'Медиумски копчиња (playpause/next)', params: { key: 'string' }, run: async (input = {}) => host.mediaKey(input.key || input.action) },
  say: { category: 'host', description: 'Изговори текст локално (без клуч)', params: { text: 'string' }, run: async (input = {}) => host.say(input.text, input) },
  notify: { category: 'host', description: 'Локална нотификација', params: { title: 'string', text: 'string' }, run: async (input = {}) => host.notify(input.title, input.text || input.message) },
};
module.exports = { tools };
