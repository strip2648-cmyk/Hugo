'use strict';
const http = require('node:http');
const { URL } = require('node:url');
const config = require('../lib/config').load();
const logger = require('../lib/logger').createLogger('ui');
const listeners = new Set();
function broadcast(event) {
  const payload = 'data: ' + JSON.stringify(event) + '\n\n';
  for (const listener of listeners) { try { listener.write(payload); } catch { listeners.delete(listener); } }
}
function page() {
  return `<!doctype html>
<html lang="mk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HUGO</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>
:root{--ink:#0b0c0e;--panel:#131519;--bone:#ece5da;--dim:#8d8578;--oxide:#e2571f;--ok:#3ec0a8}
*{box-sizing:border-box}
body{margin:0;background:var(--ink);color:var(--bone);font-family:"IBM Plex Mono",monospace;font-size:13px;line-height:1.6}
body:before{content:"";position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(236,229,218,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(236,229,218,.05) 1px,transparent 1px);background-size:48px 48px}
main{position:relative;max-width:1020px;margin:0 auto;padding:28px 20px 60px}
h1{font-family:"Instrument Serif",serif;font-size:40px;margin:0 0 4px;letter-spacing:.5px}
h1 span{color:var(--oxide)}
.sub{color:var(--dim);margin:0 0 22px}
section{background:var(--panel);border:1px solid rgba(236,229,218,.12);padding:14px 16px}
h2{font-size:11px;text-transform:uppercase;letter-spacing:.2em;color:var(--dim);margin:0 0 10px}
textarea,button,input{font-family:inherit;font-size:13px}
textarea{width:100%;min-height:78px;background:#0e1014;color:var(--bone);border:1px solid rgba(236,229,218,.16);padding:10px;resize:vertical}
button{background:transparent;color:var(--bone);border:1px solid rgba(236,229,218,.25);padding:8px 12px;cursor:pointer;transition:.15s}
button:hover{border-color:var(--oxide);color:var(--oxide)}
button.on{border-color:var(--ok);color:var(--ok)}
.composer{position:relative;margin-top:10px}
.composer textarea{padding-right:54px}
.voice{position:absolute;right:10px;bottom:10px;border:0;padding:4px 7px;font-size:18px;line-height:1;color:var(--dim)}
.voice:hover,.voice.on{border:0;color:var(--ok)}
pre{white-space:pre-wrap;word-break:break-word;margin:0;max-height:420px;overflow:auto}
.log{background:#0e1014;border:1px solid rgba(236,229,218,.12);padding:10px;min-height:220px}
.tag{display:inline-block;border:1px solid rgba(236,229,218,.2);padding:1px 7px;margin:2px 3px 2px 0;color:var(--dim)}
.ok{color:var(--ok)}.bad{color:var(--oxide)}
</style></head>
<body><main>
<h1>HUGO <span>v${config.version}</span></h1>
<p class="sub">\u043b\u043e\u043a\u0430\u043b\u0435\u043d \u043c\u043e\u0437\u043e\u043a \u2014 \u0431\u0435\u0437 \u043a\u043b\u0443\u0447\u0435\u0432\u0438. \u0433\u043e\u0432\u043e\u0440, \u043c\u0435\u043c\u043e\u0440\u0438\u0458\u0430, \u0431\u0440\u0430\u0443\u0437\u0435\u0440, \u0431\u0438\u0437\u043d\u0438\u0441.</p>
<section>
    <h2>\u0440\u0430\u0437\u0433\u043e\u0432\u043e\u0440</h2>
    <div class="composer">
      <textarea id="q" placeholder="\u041d\u0430\u043f\u0438\u0448\u0438 \u0437\u0430\u0434\u0430\u0447\u0430 \u0438\u043b\u0438 \u043f\u0440\u0430\u0448\u0430\u045a\u0435..."></textarea>
      <button id="mic" class="voice" title="\u0413\u043e\u0432\u043e\u0440\u0435\u043d \u0432\u043b\u0435\u0437">\u25c9</button>
    </div>
    <div class="log" style="margin-top:12px"><pre id="out">\u0433\u043e\u0442\u043e\u0432.</pre></div>
    <div id="events" class="log" style="margin-top:12px;min-height:120px"><pre>-</pre></div>
</section>
</main>
<script>
const token = new URLSearchParams(location.search).get('token') || '';
const out = document.getElementById('out');
const write = (value) => { out.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); };
async function api(path, body) {
  const response = await fetch(path + (path.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token), {
    method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  return response.json();
}
async function submit() {
  const field = document.getElementById('q');
  const text = field.value.trim();
  if (!text) return;
  field.value = '';
  write('\u0440\u0430\u0437\u043c\u0438\u0441\u043b\u0443\u0432\u0430\u043c...');
  const result = await api('/api/chat', { text });
  write(result.reply || '\u043d\u0435\u043c\u0430 \u043e\u0434\u0433\u043e\u0432\u043e\u0440');
}
document.getElementById('q').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); }
});
const mic = document.getElementById('mic');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
mic.onclick = () => {
  if (!SpeechRecognition) { write('\u041e\u0432\u043e\u0458 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u043d\u0435 \u043f\u043e\u0434\u0434\u0440\u0436\u0443\u0432\u0430 \u0433\u043e\u0432\u043e\u0440. \u041a\u043e\u0440\u0438\u0441\u0442\u0438 Chrome.'); return; }
  if (recognition) { recognition.stop(); recognition = null; mic.classList.remove('on'); return; }
  recognition = new SpeechRecognition();
  recognition.lang = '${config.voice.default_language}';
  recognition.continuous = ${config.voice.continuous ? 'true' : 'false'};
  recognition.interimResults = false;
  recognition.onresult = async (event) => {
    const text = event.results[event.results.length - 1][0].transcript;
    write('\u0447\u0443\u0432: ' + text);
    const replied = await api('/api/voice', { text });
    write((replied.reply || JSON.stringify(replied)) + (replied.spoken && replied.spoken.spoken ? '\\n(\u043a\u0430\u0436\u0430\u043d\u043e \u043d\u0430 \u0433\u043b\u0430\u0441)' : ''));
  };
  recognition.onerror = (event) => write('\u0433\u0440\u0435\u0448\u043a\u0430 \u0432\u043e \u0433\u043e\u0432\u043e\u0440: ' + event.error);
  recognition.start();
  mic.classList.add('on');
};
const events = new EventSource('/api/events?token=' + encodeURIComponent(token));
const box = document.getElementById('events');
box.innerHTML = '';
events.onmessage = (message) => { const line = document.createElement('div'); line.textContent = message.data; box.prepend(line); };
</script>
</body></html>`;
}
function token(req, url) {
  const expected = process.env[config.ui.token_env];
  const provided = url.searchParams.get('token') || req.headers['x-hugo-token'];
  if (!expected) return { ok: true, local_open: true };
  return { ok: provided === expected, reason: 'token mismatch' };
}
function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}
function start(options = {}) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://' + config.ui.host + ':' + config.ui.port);
    if (url.pathname === '/' ) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page());
      return;
    }
    const auth = token(req, url);
    if (!auth.ok) { json(res, 401, { ok: false, error: auth.reason }); return; }
    const runtime = require('../core/runtime');
    const readBody = () => new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
    });
    try {
      if (url.pathname === '/api/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        listeners.add(res);
        req.on('close', () => listeners.delete(res));
        res.write('data: ' + JSON.stringify({ at: new Date().toISOString(), text: 'connected' }) + '\n\n');
        return;
      }
      if (url.pathname === '/api/status') { json(res, 200, require('../core/capabilities').report()); return; }
      if (url.pathname === '/api/tools') { json(res, 200, require('../tools/registry').audit()); return; }
      if (url.pathname === '/api/chat') { const body = await readBody(); json(res, 200, await runtime.chat(body.text || body.message || '')); return; }
      if (url.pathname === '/api/run') { const body = await readBody(); json(res, 200, await runtime.run(body.action, body.args || {})); return; }
      if (url.pathname === '/api/goal') { const body = await readBody(); json(res, 200, await runtime.goal(body.text || body.goal || '')); return; }
      if (url.pathname === '/api/voice') { const body = await readBody(); json(res, 200, await require('../voice/speech').transcript(body.text || '')); return; }
      if (url.pathname === '/api/speak') { const body = await readBody(); json(res, 200, await require('../voice/speech').speak(body.text || '')); return; }
      json(res, 404, { ok: false, error: 'unknown endpoint' });
    } catch (error) {
      logger.error('ui error: ' + error.message);
      json(res, 500, { ok: false, error: error.message });
    }
  });
  const port = options.port || config.ui.port;
  server.listen(port, config.ui.host, () => {
    logger.info('HUGO controls: http://' + config.ui.host + ':' + port + '/?token=***');
    if (!process.env[config.ui.token_env]) logger.info('local UI is open on 127.0.0.1 because ' + config.ui.token_env + ' is not set');
  });
  return server;
}
module.exports = { start, page, broadcast, listeners };
