'use strict';
const os = require('node:os');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const config = require('../../lib/config').load();
const { getText } = require('../../lib/http');
const tools = {
  current_time: { category: 'system', description: '\u0422\u043e\u0447\u043d\u043e \u0432\u0440\u0435\u043c\u0435', params: { timezone: 'string' }, run: async (args) => {
    const timezone = String(args.timezone || config.automation.timezone);
    const now = new Date();
    return { timezone, time: now.toLocaleTimeString('mk-MK', { timeZone: timezone, hour12: false }), date: now.toLocaleDateString('mk-MK', { timeZone: timezone }), weekday: now.toLocaleDateString('mk-MK', { timeZone: timezone, weekday: 'long' }), iso: now.toISOString(), unix: Math.floor(now.getTime() / 1000) };
  } },
  system_info: { category: 'system', description: '\u0418\u043d\u0444\u043e \u0437\u0430 \u043a\u043e\u043c\u043f\u0458\u0443\u0442\u0435\u0440\u043e\u0442', params: {}, run: async () => ({
    platform: os.platform(), release: os.release(), arch: os.arch(), cpus: os.cpus().length, cpu_model: (os.cpus()[0] || {}).model,
    memory_total_gb: Number((os.totalmem() / 1073741824).toFixed(2)), memory_free_gb: Number((os.freemem() / 1073741824).toFixed(2)),
    uptime_hours: Number((os.uptime() / 3600).toFixed(2)), node: process.version, hostname: os.hostname(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }) },
  network_status: { category: 'system', description: '\u0414\u0430\u043b\u0438 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442\u043e\u0442 \u0440\u0430\u0431\u043e\u0442\u0438', params: {}, run: async () => {
    const results = [];
    for (const [name, url] of [['cloudflare', 'https://1.1.1.1/cdn-cgi/trace'], ['dns', 'https://dns.google/resolve?name=example.com&type=A']]) {
      const started = Date.now();
      try { const response = await getText(url, { accept: 'text/plain', timeout_ms: 8000, retries: 0 }); results.push({ name, reachable: true, ms: Date.now() - started, status: response.status }); }
      catch (error) { results.push({ name, reachable: false, error: error.message }); }
    }
    return { online: results.some((row) => row.reachable), checks: results };
  } },
  battery_status: { category: 'system', description: '\u0411\u0430\u0442\u0435\u0440\u0438\u0458\u0430', params: {}, run: async () => {
    try {
      if (os.platform() === 'darwin') return { details: execFileSync('pmset', ['-g', 'batt'], { encoding: 'utf8' }).trim() };
      if (os.platform() === 'linux') {
        return { percent: Number(fs.readFileSync('/sys/class/power_supply/BAT0/capacity', 'utf8').trim()), status: fs.readFileSync('/sys/class/power_supply/BAT0/status', 'utf8').trim() };
      }
      return { available: false, note: '\u0421\u0430\u043c\u043e macOS/Linux \u043e\u0434 \u043b\u043e\u043a\u0430\u043b\u043d\u0438\u043e\u0442 \u043b\u043e\u043e\u043f' };
    } catch (error) { return { available: false, error: error.message }; }
  } },
  notifications: { category: 'system', description: '\u041b\u043e\u043a\u0430\u043b\u043d\u0430 \u043d\u043e\u0442\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u0458\u0430', params: { title: 'string', text: 'string' }, run: async (args) => {
    const text = String(args.text || args.message || '').trim();
    if (!text) throw new Error('text is required');
    try {
      if (os.platform() === 'darwin') execFileSync('osascript', ['-e', `display notification "${text.replace(/"/g, "'")}" with title "${args.title || 'HUGO'}"`]);
      else if (os.platform() === 'linux') execFileSync('notify-send', [String(args.title || 'HUGO'), text]);
      else return { shown: false, note: '\u041d\u0430 Windows \u043a\u043e\u0440\u0438\u0441\u0442\u0438 \u0433\u043e UI-\u0442\u043e' };
      return { shown: true, title: args.title || 'HUGO', text };
    } catch (error) { return { shown: false, error: error.message }; }
  } },
  browser_status: { category: 'system', description: '\u0421\u0442\u0430\u0442\u0443\u0441 \u043d\u0430 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u043e\u0442', params: {}, run: async () => require('../../eyes/chrome').detect() },
  self_check: { category: 'system', description: '\u0421\u0430\u043c\u043e\u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430', params: {}, run: async () => require('../../core/capabilities').report() },
};
module.exports = { tools };
