'use strict';
const chrome = require('./chrome');
const { InputError } = require('../lib/errors');
const { truncate, keywords } = require('../lib/textutil');
const EXTRACT_SCRIPT = `(() => {
  const visible = (element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; };
  const text = document.body ? document.body.innerText : '';
  return JSON.stringify({
    title: document.title, url: location.href, words: text.split(/\\s+/).filter(Boolean).length, text: text.slice(0, 6000),
    links: [...document.querySelectorAll('a[href]')].filter(visible).slice(0, 60).map((a) => ({ text: (a.innerText || '').trim().slice(0, 120), href: a.href })),
    buttons: [...document.querySelectorAll('button, [role=button], input[type=submit]')].filter(visible).slice(0, 40).map((b) => ({ text: (b.innerText || b.value || '').trim().slice(0, 80), tag: b.tagName.toLowerCase() })),
    forms: [...document.querySelectorAll('form')].slice(0, 10).map((form) => ({ action: form.action, method: (form.method || 'get').toLowerCase(), fields: [...form.querySelectorAll('input, textarea, select')].map((field) => ({ name: field.name, type: field.type || field.tagName.toLowerCase() })).filter((field) => field.name) })),
    headings: [...document.querySelectorAll('h1, h2, h3')].filter(visible).slice(0, 30).map((h) => ({ level: h.tagName.toLowerCase(), text: (h.innerText || '').trim().slice(0, 140) })),
    tables: [...document.querySelectorAll('table')].slice(0, 5).map((table) => [...table.querySelectorAll('tr')].slice(0, 12).map((row) => [...row.querySelectorAll('th, td')].map((cell) => (cell.innerText || '').trim().slice(0, 60))))
  });
})()`;
function findElementScript(text) {
  return `(() => {
    const target = ${JSON.stringify(String(text))}.trim().toLowerCase();
    const nodes = [...document.querySelectorAll('a, button, input, [role=button], li, span, div, h1, h2, h3')].filter((element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; });
    let best = null;
    for (const node of nodes) {
      const label = ((node.innerText || node.value || node.getAttribute('aria-label') || '') + '').trim().toLowerCase();
      if (!label) continue;
      let score = label === target ? 100 : (label.includes(target) ? 60 - Math.min(label.length, 40) / 4 : 0);
      if (!score) continue;
      if (node.tagName === 'A' || node.tagName === 'BUTTON') score += 10;
      if (!best || score > best.score) { const rect = node.getBoundingClientRect(); best = { score, label, tag: node.tagName.toLowerCase(), x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true }; }
    }
    return JSON.stringify(best || { found: false });
  })()`;
}
async function read(url, options = {}) {
  const session = await chrome.attach(options);
  try {
    if (url) { await session.send('Page.navigate', { url }); await new Promise((resolve) => setTimeout(resolve, options.wait_ms === undefined ? 1200 : options.wait_ms)); }
    const result = await session.send('Runtime.evaluate', { expression: EXTRACT_SCRIPT, returnByValue: true });
    return JSON.parse(result.result.value || '{}');
  } finally { session.close(); }
}
async function run(action, args = {}) {
  if (action === 'browser_status') return chrome.detect();
  if (action === 'browser_launch') return chrome.launch(args);
  if (action === 'browser_tabs') return { tabs: (await chrome.targets()).filter((target) => target.type === 'page').map((target) => ({ id: target.id, title: target.title, url: target.url })) };
  if (action === 'browser_open') {
    if (!args.url) throw new InputError('url is required');
    return chrome.navigate(args.url, args);
  }
  if (action === 'browser_read') {
    const page = await read(args.url, args);
    return { url: page.url, title: page.title, words: page.words, text: truncate(page.text || '', args.limit || 4000), links: (page.links || []).slice(0, 30), headings: (page.headings || []).slice(0, 20) };
  }
  if (action === 'browser_summary') {
    const page = await read(args.url, args);
    return { url: page.url, title: page.title, keywords: keywords(page.text || '', 10).map((item) => item.token), headings: page.headings, forms: page.forms, tables: page.tables, buttons: (page.buttons || []).slice(0, 15), text: truncate(page.text || '', 1500) };
  }
  if (action === 'browser_search') {
    if (args.url) return read(args.url, args);
    const query = String(args.query || args.text || '').trim();
    if (!query) throw new InputError('query is required');
    const page = await read('https://duckduckgo.com/html/?q=' + encodeURIComponent(query), { wait_ms: args.wait_ms || 2000 });
    return { query, url: page.url, title: page.title, results: (page.links || []).filter((link) => /^https?:\/\//.test(link.href) && !link.href.includes('duckduckgo')).slice(0, 12), text: truncate(page.text || '', 1500), via: 'your browser' };
  }
  if (action === 'browser_screenshot') {
    const shot = await chrome.screenshot(args.url, args);
    return { ...shot, note: '\u0421\u043b\u0438\u043a\u0430\u0442\u0430 \u0435 \u0437\u0430\u0447\u0443\u0432\u0430\u043d\u0430 \u043b\u043e\u043a\u0430\u043b\u043d\u043e \u043d\u0430 \u0442\u0432\u043e\u0458\u043e\u0442 \u043a\u043e\u043c\u043f\u0458\u0443\u0442\u0435\u0440' };
  }
  if (action === 'browser_click') {
    const session = await chrome.attach(args);
    try {
      if (args.url) { await session.send('Page.navigate', { url: args.url }); await new Promise((resolve) => setTimeout(resolve, args.wait_ms || 1200)); }
      if (args.selector) {
        await session.send('Runtime.evaluate', { expression: 'document.querySelector(' + JSON.stringify(args.selector) + ').click()', returnByValue: true });
      } else {
        const found = await session.send('Runtime.evaluate', { expression: findElementScript(args.text || args.label || ''), returnByValue: true });
        const target = JSON.parse(found.result.value || '{}');
        if (!target.found) return { clicked: false, reason: '\u043d\u0435 \u043d\u0430\u0458\u0434\u043e\u0432 \u0435\u043b\u0435\u043c\u0435\u043d\u0442 \u0441\u043e \u0442\u0435\u043a\u0441\u0442: ' + (args.text || '') };
        await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 });
        await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 });
      }
      await new Promise((resolve) => setTimeout(resolve, args.wait_ms || 800));
      const url = await session.send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
      return { clicked: true, now_at: url.result.value };
    } finally { session.close(); }
  }
  if (action === 'browser_type') {
    const session = await chrome.attach(args);
    try {
      if (args.url) { await session.send('Page.navigate', { url: args.url }); await new Promise((resolve) => setTimeout(resolve, args.wait_ms || 1200)); }
      if (args.selector) await session.send('Runtime.evaluate', { expression: 'document.querySelector(' + JSON.stringify(args.selector) + ').focus()', returnByValue: true });
      else if (args.focus_text) {
        const found = await session.send('Runtime.evaluate', { expression: findElementScript(args.focus_text), returnByValue: true });
        const target = JSON.parse(found.result.value || '{}');
        if (target.found) {
          await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 });
          await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 });
        }
      }
      await session.send('Input.insertText', { text: String(args.text || '') });
      if (args.enter) await session.send('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: 13, key: 'Enter', code: 'Enter' });
      return { typed: String(args.text || '').length, enter: Boolean(args.enter) };
    } finally { session.close(); }
  }
  if (action === 'browser_form') {
    const fields = args.fields || {};
    const session = await chrome.attach(args);
    try {
      if (args.url) { await session.send('Page.navigate', { url: args.url }); await new Promise((resolve) => setTimeout(resolve, args.wait_ms || 1200)); }
      const filled = [];
      for (const [name, value] of Object.entries(fields)) {
        const script = '(() => { const field = document.querySelector("[name=\\"" + ' + JSON.stringify(name) + ' + "\\"]"); if (!field) return false; field.focus(); field.value = ' + JSON.stringify(String(value)) + '; field.dispatchEvent(new Event("input", { bubbles: true })); field.dispatchEvent(new Event("change", { bubbles: true })); return true; })()';
        const result = await session.send('Runtime.evaluate', { expression: script, returnByValue: true });
        filled.push({ name, filled: Boolean(result.result.value) });
      }
      let submitted = false;
      if (args.submit) {
        const submit = await session.send('Runtime.evaluate', { expression: '(() => { const form = document.querySelector("form"); if (!form) return false; const button = form.querySelector("[type=submit], button"); if (button) { button.click(); return true; } form.submit(); return true; })()', returnByValue: true });
        submitted = Boolean(submit.result.value);
      }
      return { filled, submitted };
    } finally { session.close(); }
  }
  if (action === 'browser_eval') {
    if (!args.expression) throw new InputError('expression is required');
    return chrome.evaluate(args.expression, { await_promise: args.await_promise });
  }
  throw new InputError('unknown browser action: ' + action);
}
function actions() {
  const definitions = [
    ['browser_status', '\u0421\u0442\u0430\u0442\u0443\u0441 \u043d\u0430 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u043e\u0442', {}],
    ['browser_launch', '\u0421\u0442\u0430\u0440\u0442\u0443\u0432\u0430\u0458 Chrome \u0441\u043e HUGO \u043f\u0440\u043e\u0444\u0438\u043b', {}],
    ['browser_open', '\u041e\u0442\u0432\u043e\u0440\u0438 URL', { url: 'string' }],
    ['browser_read', '\u0427\u0438\u0442\u0430\u0458 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430', { url: 'string' }],
    ['browser_summary', '\u0420\u0430\u0437\u0431\u0435\u0440\u0438 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430 (\u0444\u043e\u0440\u043c\u0438, \u0442\u0430\u0431\u0435\u043b\u0438, \u043d\u0430\u0441\u043b\u043e\u0432\u0438)', { url: 'string' }],
    ['browser_search', '\u041f\u0440\u0435\u0431\u0430\u0440\u0430\u0458 \u043d\u0430 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442', { query: 'string' }],
    ['browser_screenshot', '\u0421\u043b\u0438\u043a\u0430 \u043e\u0434 \u0435\u043a\u0440\u0430\u043d', { url: 'string' }],
    ['browser_click', '\u041a\u043b\u0438\u043a\u043d\u0438 \u043d\u0430 \u0435\u043b\u0435\u043c\u0435\u043d\u0442', { text: 'string', selector: 'string' }],
    ['browser_type', '\u041d\u0430\u043f\u0438\u0448\u0438 \u0442\u0435\u043a\u0441\u0442', { text: 'string', selector: 'string', enter: 'boolean' }],
    ['browser_form', '\u041f\u043e\u043f\u043e\u043b\u043d\u0438 \u0444\u043e\u0440\u043c\u0430', { url: 'string', fields: 'object', submit: 'boolean' }],
    ['browser_eval', '\u0418\u0437\u0432\u0440\u0448\u0438 \u043a\u043e\u0434 \u0432\u043e \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430\u0442\u0430', { expression: 'string' }],
    ['browser_tabs', '\u041b\u0438\u0441\u0442\u0430 \u0442\u0430\u0431\u043e\u0432\u0438', {}],
  ];
  return definitions.map(([name, description, params]) => ({ name, description, params, category: 'eyes', handler: async (input) => run(name, input) }));
}
module.exports = { run, read, actions, EXTRACT_SCRIPT };
