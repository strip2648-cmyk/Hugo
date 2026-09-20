'use strict';
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const config = require('../lib/config').load();
const { ensureDir } = require('../lib/fsx');
const { NetworkError } = require('../lib/errors');
const logger = require('../lib/logger').createLogger('eyes');
const BASE = config.browser.host + ':' + config.browser.port;
function request(method, urlPath) {
  return new Promise((resolve, reject) => {
    const call = http.request({ host: config.browser.host, port: config.browser.port, path: urlPath, method, timeout: 8000 }, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({ raw: body }); } });
    });
    call.on('timeout', () => { call.destroy(); reject(new NetworkError('chrome debug endpoint timed out')); });
    call.on('error', (error) => reject(new NetworkError('chrome debug endpoint unreachable: ' + error.message)));
    call.end();
  });
}
function targets() { return request('GET', '/json/list'); }
function versionInfo() { return request('GET', '/json/version'); }
function detect() {
  const { execFileSync } = require('node:child_process');
  let reachable = false; let info = null;
  try { info = JSON.parse(execFileSync('curl', ['-s', '--max-time', '3', 'http://' + BASE + '/json/version'], { encoding: 'utf8' })); reachable = Boolean(info && info.Browser); }
  catch { reachable = false; }
  return {
    reachable, host: config.browser.host, port: config.browser.port,
    browser: info ? info.Browser : null, protocol: info ? info['Protocol-Version'] : null,
    profile: config.browser.profile, hint: reachable ? null : 'start your browser with: npm run chrome',
  };
}
function chromeBinary() {
  if (config.browser.bin && config.browser.bin !== 'auto') return config.browser.bin;
  const candidates = {
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    win32: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
  }[os.platform()] || [];
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  return candidates[0] || null;
}
function defaultProfileDir() {
  const home = os.homedir();
  if (os.platform() === 'darwin') return path.join(home, 'Library/Application Support/Google/Chrome');
  if (os.platform() === 'win32') return path.join(home, 'AppData/Local/Google/Chrome/User Data');
  return path.join(home, '.config/google-chrome');
}
function copyProfile(from, to) {
  ensureDir(to);
  for (const entry of ['Default', 'Local State', 'Network']) {
    const source = path.join(from, entry);
    if (!fs.existsSync(source)) continue;
    try { fs.cpSync(source, path.join(to, entry), { recursive: true, force: false, errorOnExist: false }); }
    catch (error) { logger.warn('could not copy ' + entry + ': ' + error.message); }
  }
  return to;
}
function launch(options = {}) {
  const binary = chromeBinary();
  if (!binary) throw new Error('Chrome not found; set HUGO_CHROME_BIN');
  const profile = path.resolve(config.root, config.browser.profile);
  const fresh = options.fresh === true || config.browser.profile_mode === 'fresh';
  if (fresh) ensureDir(profile);
  else if (!fs.existsSync(path.join(profile, 'Default'))) copyProfile(options.source_profile || defaultProfileDir(), profile);
  const args = ['--remote-debugging-port=' + config.browser.port, '--user-data-dir=' + profile, '--remote-allow-origins=*', '--no-first-run', '--no-default-browser-check', options.url || 'about:blank'];
  const child = spawn(binary, args, { detached: true, stdio: 'ignore' });
  child.unref();
  return { launched: true, binary, profile, port: config.browser.port, note: fresh ? 'clean profile: log in once in this window' : 'your logins are copied into the HUGO profile' };
}
class WsClient {
  constructor(socket, rest) {
    this.socket = socket;
    this.buffer = Buffer.from(rest, 'binary');
    this.handlers = [];
    this.closed = false;
    socket.on('data', (chunk) => { this.buffer = Buffer.concat([this.buffer, chunk]); this.drain(); });
    socket.on('close', () => { this.closed = true; });
  }
  drain() {
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const opcode = first & 0x0f;
      const masked = (second & 0x80) === 0x80;
      let length = second & 0x7f;
      let offset = 2;
      if (length === 126) { if (this.buffer.length < 4) return; length = this.buffer.readUInt16BE(2); offset = 4; }
      else if (length === 127) { if (this.buffer.length < 10) return; length = Number(this.buffer.readBigUInt64BE(2)); offset = 10; }
      let mask = null;
      if (masked) { if (this.buffer.length < offset + 4) return; mask = this.buffer.slice(offset, offset + 4); offset += 4; }
      if (this.buffer.length < offset + length) return;
      const payload = Buffer.from(this.buffer.slice(offset, offset + length));
      if (mask) for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
      this.buffer = this.buffer.slice(offset + length);
      if (opcode === 0x1 || opcode === 0x2) for (const handler of this.handlers) handler(payload.toString('utf8'));
      else if (opcode === 0x8) { this.close(); return; }
      else if (opcode === 0x9) this.frame(payload, 0xa);
    }
  }
  frame(payload, opcode = 0x1) {
    const mask = crypto.randomBytes(4);
    const length = payload.length;
    let header;
    if (length < 126) { header = Buffer.alloc(6); header[1] = 0x80 | length; }
    else if (length < 65536) { header = Buffer.alloc(8); header[1] = 0x80 | 126; header.writeUInt16BE(length, 2); }
    else { header = Buffer.alloc(14); header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(length), 2); }
    header[0] = 0x80 | opcode;
    mask.copy(header, header.length - 4);
    const masked = Buffer.alloc(length);
    for (let index = 0; index < length; index += 1) masked[index] = payload[index] ^ mask[index % 4];
    this.socket.write(Buffer.concat([header, masked]));
  }
  send(text) { this.frame(Buffer.from(text, 'utf8')); }
  onMessage(handler) { this.handlers.push(handler); }
  close() { if (!this.closed) { this.closed = true; try { this.socket.end(); } catch { /* ignore */ } } }
}
function connectWebSocket(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const key = crypto.randomBytes(16).toString('base64');
    const socket = net.connect(Number(parsed.port) || 80, parsed.hostname, () => {
      socket.write('GET ' + parsed.pathname + parsed.search + ' HTTP/1.1\r\nHost: ' + parsed.host + '\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
    });
    let handshake = Buffer.alloc(0);
    const onData = (chunk) => {
      handshake = Buffer.concat([handshake, chunk]);
      const marker = handshake.indexOf('\r\n\r\n');
      if (marker < 0) return;
      const head = handshake.slice(0, marker).toString('utf8');
      if (!/ 101 /.test(head.split('\r\n')[0])) { socket.destroy(); reject(new NetworkError('websocket handshake failed: ' + head.split('\r\n')[0])); return; }
      socket.removeListener('data', onData);
      resolve(new WsClient(socket, handshake.slice(marker + 4)));
    };
    socket.on('data', onData);
    socket.on('error', (error) => reject(new NetworkError('websocket error: ' + error.message)));
    socket.setTimeout(15000, () => { socket.destroy(); reject(new NetworkError('websocket timeout')); });
  });
}
async function attach(options = {}) {
  let list = await targets();
  if (!Array.isArray(list)) list = [];
  let pages = list.filter((target) => target.type === 'page');
  if (!pages.length) {
    try { await request('PUT', '/json/new?about:blank'); } catch { await request('GET', '/json/new?about:blank'); }
    list = await targets();
    pages = (Array.isArray(list) ? list : []).filter((target) => target.type === 'page');
    if (!pages.length) throw new NetworkError('no browser page available');
  }
  let page = pages[0];
  if (options.tab_id) { const selected = pages.find((target) => target.id === options.tab_id); if (selected) page = selected; }
  if (options.tab_index !== undefined && pages[options.tab_index]) page = pages[options.tab_index];
  if (options.url_match) { const match = pages.find((target) => String(target.url).includes(options.url_match)); if (match) page = match; }
  const client = await connectWebSocket(page.webSocketDebuggerUrl);
  let counter = 0;
  const pending = new Map();
  const events = [];
  client.onMessage((text) => {
    let message;
    try { message = JSON.parse(text); } catch { return; }
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message + ' (' + entry.method + ')'));
      else entry.resolve(message.result);
      return;
    }
    events.push({ method: message.method, params: message.params });
  });
  const send = (method, params = {}, timeout = 30000) => new Promise((resolve, reject) => {
    counter += 1;
    const id = counter;
    const timer = setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('CDP timeout: ' + method)); } }, timeout);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); }, method });
    client.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable').catch(() => null);
  await send('Runtime.enable').catch(() => null);
  return { client, send, events, page, close: () => client.close() };
}
async function evaluate(expression, options = {}) {
  const session = await attach(options);
  try {
    const result = await session.send('Runtime.evaluate', { expression, awaitPromise: options.await_promise !== false, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'page evaluation failed');
    return { value: result.result && result.result.value, url: session.page.url };
  } finally { session.close(); }
}
async function navigate(url, options = {}) {
  const created = await newTab(url);
  if (!created.ok || !created.tab || !created.tab.id) throw new NetworkError('could not create a new browser tab');
  const session = await attach({ ...options, tab_id: created.tab.id });
  try {
    await new Promise((resolve) => setTimeout(resolve, options.wait_ms === undefined ? config.browser.navigation_wait_ms : options.wait_ms));
    const info = await session.send('Runtime.evaluate', { expression: 'JSON.stringify({title: document.title, url: location.href})', returnByValue: true });
    let meta = { title: '', url };
    try { meta = JSON.parse(info.result.value); } catch { /* ignore */ }
    return { ...meta, tab_id: created.tab.id, new_tab: true };
  } finally { session.close(); }
}
async function screenshot(url, options = {}) {
  const session = await attach(options);
  try {
    if (url) { await session.send('Page.navigate', { url }); await new Promise((resolve) => setTimeout(resolve, options.wait_ms || config.browser.navigation_wait_ms)); }
    const shot = await session.send('Page.captureScreenshot', { format: options.format || 'png', captureBeyondViewport: options.full_page !== false });
    const dir = path.resolve(config.root, config.browser.screenshot_dir);
    ensureDir(dir);
    const file = path.join(dir, 'shot-' + Date.now() + '.' + (options.format || 'png'));
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    return { file, bytes: Buffer.from(shot.data, 'base64').length, url };
  } finally { session.close(); }
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function ensure(options = {}) {
  const before = detect();
  if (before.reachable) return { ...before, mode: 'attached' };
  let launched = null;
  try { launched = launch(options); } catch (error) { return { ...before, mode: 'failed', error: error.message, hint: 'постави HUGO_CHROME_BIN ако Chrome е на необично место' }; }
  for (let index = 0; index < 24; index += 1) {
    await sleep(500);
    const now = detect();
    if (now.reachable) return { ...now, mode: 'launched', launched };
  }
  return { ...detect(), mode: 'failed', launched, hint: 'Chrome не одговори на debug портата ' + config.browser.port };
}
async function tabs() {
  const list = await targets();
  return (Array.isArray(list) ? list : []).filter((target) => target.type === 'page').map((target) => ({ id: target.id, title: target.title, url: target.url, ws: target.webSocketDebuggerUrl }));
}
async function keyboard(key, options = {}) {
  const map = {
    Enter: { windowsVirtualKeyCode: 13, key: 'Enter', code: 'Enter', text: '\r' },
    Escape: { windowsVirtualKeyCode: 27, key: 'Escape', code: 'Escape' },
    Tab: { windowsVirtualKeyCode: 9, key: 'Tab', code: 'Tab' },
    ArrowDown: { windowsVirtualKeyCode: 40, key: 'ArrowDown', code: 'ArrowDown' },
    ArrowUp: { windowsVirtualKeyCode: 38, key: 'ArrowUp', code: 'ArrowUp' },
    Space: { windowsVirtualKeyCode: 32, key: ' ', code: 'Space', text: ' ' },
    SpacePlayPause: { windowsVirtualKeyCode: 179, key: 'MediaPlayPause', code: 'MediaPlayPause' },
  };
  const info = map[key] || { windowsVirtualKeyCode: 0, key, code: key };
  const session = await attach(options);
  try {
    const modifiers = options.shift ? 8 : 0;
    await session.send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers, windowsVirtualKeyCode: info.windowsVirtualKeyCode, key: info.key, code: info.code, text: options.shift ? undefined : info.text });
    await session.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, windowsVirtualKeyCode: info.windowsVirtualKeyCode, key: info.key, code: info.code });
    return { pressed: key, code: info.windowsVirtualKeyCode };
  } finally { session.close(); }
}
async function newTab(url = 'about:blank') {
  let created = null;
  try { created = await request('PUT', '/json/new?' + encodeURIComponent(url)); } catch { try { created = await request('GET', '/json/new?' + encodeURIComponent(url)); } catch (error) { return { ok: false, error: error.message }; } }
  return { ok: Boolean(created && created.id), tab: created ? { id: created.id, url: created.url || url } : null };
}

module.exports = { detect, launch, attach, evaluate, navigate, screenshot, targets, versionInfo, chromeBinary, copyProfile, defaultProfileDir, WsClient, connectWebSocket, request, BASE, ensure, tabs, keyboard, newTab };
