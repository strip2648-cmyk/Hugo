'use strict';

/* Shared Chrome helpers for site automation (uses the user's own logged-in Chrome via CDP). */
const chrome = require('../eyes/chrome');
const { InputError } = require('../lib/errors');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function open(options = {}) { return chrome.attach(options); }
async function evalValue(session, expression, options = {}) {
  const result = await session.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: options.await_promise === true });
  if (result.exceptionDetails) return { error: result.exceptionDetails.text || 'page error', value: null };
  return { error: null, value: result.result ? result.result.value : null };
}
async function evalJson(session, script) {
  const r = await evalValue(session, '(() => { try { return JSON.stringify(' + script + '); } catch (e) { return JSON.stringify({ __error: String(e) }); } })()');
  if (r.error) return { __error: r.error };
  try { return JSON.parse(r.value || '{}'); } catch (error) { return { __error: 'parse: ' + error.message }; }
}
async function currentUrl(session) { const r = await evalValue(session, 'location.href'); return r.value || ''; }
async function currentTitle(session) { const r = await evalValue(session, 'document.title'); return r.value || ''; }
async function goto(session, url, options = {}) {
  const wait = options.wait_ms === undefined ? 2500 : options.wait_ms;
  await session.send('Page.navigate', { url });
  await sleep(wait);
  const state = await evalValue(session, 'document.readyState');
  if (state.value !== 'complete') await sleep(Math.min(4000, wait));
  return { url: await currentUrl(session), title: await currentTitle(session) };
}
async function waitFor(session, script, options = {}) {
  const timeout = Number(options.timeout_ms || 20000);
  const interval = Number(options.interval_ms || 400);
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const r = await evalValue(session, '(() => { try { return Boolean(' + script + '); } catch (e) { return false; } })()');
    if (r.value === true) return { ok: true, ms: Date.now() - started };
    await sleep(interval);
  }
  return { ok: false, ms: Date.now() - started, timeout_ms: timeout };
}
async function clickSelector(session, selector) {
  const clicked = await evalValue(session, '(() => { const e = document.querySelector(' + JSON.stringify(selector) + '); if (!e) return false; e.scrollIntoView({ block: "center" }); e.click(); return true; })()');
  if (clicked.value === true) return { clicked: true, how: 'dom-click' };
  const box = await evalJson(session, '(function(){ const e = document.querySelector(' + JSON.stringify(selector) + '); if (!e) return { found: false }; const r = e.getBoundingClientRect(); return { found: true, x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()');
  if (!box.found) return { clicked: false, reason: 'not found: ' + selector };
  await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  return { clicked: true, how: 'mouse' };
}
async function clickOneOf(session, selectors) {
  for (const selector of selectors) {
    const exists = await evalValue(session, 'Boolean(document.querySelector(' + JSON.stringify(selector) + '))');
    if (exists.value === true) { const r = await clickSelector(session, selector); if (r.clicked) return { ...r, selector }; }
  }
  return { clicked: false, reason: 'none of ' + selectors.length + ' selectors matched' };
}
async function clickByText(session, texts, tags) {
  const script = '(function(){ const texts = ' + JSON.stringify(texts) + '; const tags = ' + JSON.stringify(tags || ['button', '[role=button]', 'div', 'span', 'a']) + '; const nodes = [...document.querySelectorAll(tags.join(","))].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }); for (const t of texts) { const needle = t.toLowerCase(); for (const node of nodes) { const label = (node.innerText || node.getAttribute("aria-label") || "").trim().toLowerCase(); if (label === needle || label.includes(needle)) { node.scrollIntoView({ block: "center" }); node.click(); return { clicked: true, label: label.slice(0, 60), tag: node.tagName.toLowerCase() }; } } } return { clicked: false }; })()';
  return evalJson(session, script);
}
async function typeText(session, selector, text) {
  const focused = await evalValue(session, '(() => { const e = document.querySelector(' + JSON.stringify(selector) + '); if (!e) return false; e.focus(); if (e.isContentEditable) { e.innerText = ""; } else { e.value = ""; } return true; })()');
  if (focused.value !== true) return { typed: false, reason: 'no field: ' + selector };
  await session.send('Input.insertText', { text: String(text) });
  await sleep(120);
  const value = await evalJson(session, '(function(){ const e = document.querySelector(' + JSON.stringify(selector) + '); if (!e) return ""; return e.isContentEditable ? e.innerText : e.value; })()');
  return { typed: true, value: value };
}
async function pressKey(session, key, options = {}) {
  const map = { Enter: { windowsVirtualKeyCode: 13, key: 'Enter', code: 'Enter', text: '\r' }, Escape: { windowsVirtualKeyCode: 27, key: 'Escape', code: 'Escape' }, ArrowDown: { windowsVirtualKeyCode: 40, key: 'ArrowDown', code: 'ArrowDown' }, Space: { windowsVirtualKeyCode: 32, key: ' ', code: 'Space', text: ' ' } };
  const info = map[key] || { windowsVirtualKeyCode: 0, key, code: key };
  const modifiers = options.shift ? 8 : 0;
  await session.send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers, windowsVirtualKeyCode: info.windowsVirtualKeyCode, key: info.key, code: info.code, text: options.shift ? undefined : info.text });
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, windowsVirtualKeyCode: info.windowsVirtualKeyCode, key: info.key, code: info.code });
  return { pressed: key };
}
async function pageText(session, limit = 6000) {
  const r = await evalValue(session, '(() => { const t = document.body ? document.body.innerText : ""; return t.slice(0, ' + Number(limit) + '); })()');
  return r.value || '';
}
async function screenshot(session, options = {}) {
  const shot = await session.send('Page.captureScreenshot', { format: options.format || 'png', captureBeyondViewport: options.full_page !== false });
  const fs = require('node:fs'); const path = require('node:path');
  const config = require('../lib/config').load();
  const dir = options.dir || path.join(config.root, config.browser.screenshot_dir || '.hugo/screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'site-' + Date.now() + '.' + (options.format || 'png'));
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  return { file, bytes: Buffer.from(shot.data, 'base64').length, verified: fs.existsSync(file) };
}
module.exports = { open, close: (s) => { try { s.close(); } catch {} }, evalValue, evalJson, currentUrl, currentTitle, goto, waitFor, clickSelector, clickOneOf, clickByText, typeText, pressKey, pageText, screenshot, sleep };
