'use strict';

process.env.HUGO_CHROME_PORT = '9333';
process.env.HUGO_FB_HOME = 'http://127.0.0.1:8799/';
const http = require('node:http');
const { spawn } = require('node:child_process');
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Facebook mock</title></head><body>
<div role="main"><div role="button" tabindex="0" aria-label="What's on your mind?">Што има ново, Стефан? Напиши нешто...</div>
<div id="feed" role="feed"></div></div>
<script>
const trigger = document.querySelector('[role=button]');
trigger.onclick = () => {
  const d = document.createElement('div'); d.setAttribute('role','dialog');
  d.innerHTML = '<div contenteditable="true" role="textbox" aria-label="Create post"></div><div role="button" aria-label="Post" id="postBtn">Објави</div>';
  document.body.appendChild(d);
  document.getElementById('postBtn').onclick = () => {
    const txt = (d.querySelector('[contenteditable]').innerText || '').trim();
    const a = document.createElement('div'); a.setAttribute('role','article'); a.innerText = txt;
    document.getElementById('feed').appendChild(a); d.remove();
  };
};
</script></body></html>`;
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(PAGE); });
server.listen(8799, '127.0.0.1', async () => {
  const chrome = spawn('/tmp/e/chrome-headless-shell-linux64/chrome-headless-shell', ['--remote-debugging-port=9333', '--user-data-dir=/tmp/e/prof', '--no-sandbox', '--disable-gpu', '--mute-audio', '--no-first-run', 'http://127.0.0.1:8799/'], { stdio: 'ignore' });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let ready = false;
  for (let i = 0; i < 40; i += 1) { await sleep(500); try { const res = await fetch('http://127.0.0.1:9333/json/version'); if (res.ok) { ready = true; break; } } catch {} }
  console.log('chrome ready:', ready);
  if (!ready) { chrome.kill(); server.close(); process.exit(1); }
  const facebook = require('./scripts/sites/facebook');
  const chromeMod = require('./scripts/eyes/chrome');
  const opened = await facebook.fbOpen();
  console.log('fb_open ->', JSON.stringify({ ok: opened.ok, url: opened.url, verified: opened.verified }));
  const written = await facebook.fbWritePost({ text: 'HUGO JARVIS тест пост' });
  console.log('fb_write_post ->', JSON.stringify({ ok: written.ok, written: written.written, verified: written.verified }));
  const published = await facebook.fbPublish({ text: 'HUGO JARVIS тест пост' });
  console.log('fb_publish ->', JSON.stringify({ ok: published.ok, published: published.published, verified: published.verified, how: published.verified_how, in_feed: published.found_in_feed }));
  const keys = await chromeMod.keyboard('Enter');
  console.log('keyboard ->', JSON.stringify(keys));
  chrome.kill(); server.close();
  const pass = opened.ok && written.written && published.published && published.verified;
  console.log(pass ? 'E2E PASS: Facebook протокот работи во вистински Chromium' : 'E2E FAIL');
  process.exit(pass ? 0 : 1);
});
