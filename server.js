'use strict';
const http = require('node:http');
const config = require('../lib/config').load();
const logger = require('../lib/logger').createLogger('gateway');
const hits = new Map();
function rateLimited(key) {
  const window = config.gateway.rate_limit.window_ms;
  const max = config.gateway.rate_limit.max;
  const now = Date.now();
  const list = (hits.get(key) || []).filter((at) => now - at < window);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}
function start(options = {}) {
  const server = http.createServer(async (req, res) => {
    const expected = process.env[config.gateway.token_env];
    const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.headers['x-hugo-token'];
    const send = (status, payload) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); };
    if (!expected) return send(503, { ok: false, error: 'set ' + config.gateway.token_env + ' to enable the gateway' });
    if (provided !== expected) return send(401, { ok: false, error: 'unauthorized' });
    if (rateLimited(req.socket.remoteAddress || 'local')) return send(429, { ok: false, error: 'rate limit exceeded' });
    if (req.method !== 'POST') return send(405, { ok: false, error: 'use POST' });
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      let input = {};
      try { input = body ? JSON.parse(body) : {}; } catch { return send(400, { ok: false, error: 'invalid JSON' }); }
      const runtime = require('../core/runtime');
      if (req.url === '/command') {
        if (input.action === 'health') return send(200, { ok: true, version: config.version, pid: process.pid });
        const result = await runtime.run(input.action, input.input || {}, { session: 'gateway' });
        return send(result.ok ? 200 : 400, result);
      }
      if (req.url === '/chat') return send(200, await runtime.chat(input.text || input.message || ''));
      if (req.url === '/status') return send(200, require('../core/capabilities').report());
      return send(404, { ok: false, error: 'unknown endpoint' });
    });
  });
  server.listen(options.port || config.gateway.port, config.gateway.host, () => logger.info('gateway on http://' + config.gateway.host + ':' + (options.port || config.gateway.port)));
  return server;
}
module.exports = { start };
