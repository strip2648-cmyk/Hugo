'use strict';

/* Real screen/page understanding without any API key: live DOM + geometry + optional local OCR. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const config = require('../lib/config').load();
const chrome = require('./chrome');
const host = require('../host/host');
const { truncate, keywords } = require('../lib/textutil');

const UNDERSTAND = `(() => {
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.top > -20000; };
  const label = (el) => ((el.innerText || el.value || el.getAttribute('aria-label') || el.placeholder || '') + '').trim().replace(/\\s+/g, ' ').slice(0, 90);
  const nodes = [...document.querySelectorAll('body *')].filter(visible);
  const big = nodes.map((el) => { const r = el.getBoundingClientRect(); return { tag: el.tagName.toLowerCase(), label: label(el), area: Math.round(r.width * r.height), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((n) => n.label && n.area > 4000).sort((a, b) => b.area - a.area).slice(0, 25);
  return JSON.stringify({
    title: document.title, url: location.href,
    viewport: { w: innerWidth, h: innerHeight, scroll_y: Math.round(scrollY) },
    text: (document.body ? document.body.innerText : '').slice(0, 6000),
    headings: [...document.querySelectorAll('h1,h2,h3')].filter(visible).slice(0, 25).map((h) => ({ level: h.tagName.toLowerCase(), text: label(h) })),
    buttons: [...document.querySelectorAll('button,[role=button],input[type=submit],a')].filter(visible).slice(0, 60).map((b) => ({ tag: b.tagName.toLowerCase(), text: label(b), href: b.href || null })),
    inputs: [...document.querySelectorAll('input,textarea,select,[contenteditable=true]')].filter(visible).slice(0, 40).map((i) => ({ type: i.type || i.tagName.toLowerCase(), name: i.name || i.getAttribute('aria-label') || i.placeholder || null })),
    images: [...document.querySelectorAll('img')].filter(visible).slice(0, 25).map((i) => ({ alt: (i.alt || '').slice(0, 80), src: (i.src || '').slice(0, 160), w: i.naturalWidth, h: i.naturalHeight })),
    tables: [...document.querySelectorAll('table')].slice(0, 4).map((t) => [...t.querySelectorAll('tr')].slice(0, 10).map((row) => [...row.querySelectorAll('th,td')].map((c) => label(c).slice(0, 50)))),
    largest: big,
  });
})()`;
function ocr(file) {
  const bin = host.which('tesseract');
  if (!bin) return { available: false, note: 'tesseract не е инсталиран (опционално: дава текст од сликата)' };
  try {
    const text = execFileSync(bin, [file, 'stdout', '-l', 'mkd+eng'], { encoding: 'utf8', timeout: 60000 });
    return { available: true, text: truncate(text, 4000), engine: 'tesseract' };
  } catch (error) { return { available: true, error: error.message }; }
}
async function describePage(input = {}) {
  const session = await chrome.attach(input);
  try {
    if (input.url) { await session.send('Page.navigate', { url: input.url }); await new Promise((r) => setTimeout(r, input.wait_ms || 2500)); }
    const result = await session.send('Runtime.evaluate', { expression: UNDERSTAND, returnByValue: true });
    let page = {};
    try { page = JSON.parse(result.result.value || '{}'); } catch { page = { raw: result.result && result.result.value }; }
    const summary = {
      where: page.title ? `${page.title} — ${page.url}` : page.url,
      readable_text: page.text ? page.text.slice(0, 1500) : '',
      top_keywords: keywords(page.text || '', 10).map((k) => k.token),
      can_click: (page.buttons || []).slice(0, 15).map((b) => b.text).filter(Boolean),
      can_type_into: (page.inputs || []).slice(0, 10),
      headings: (page.headings || []).slice(0, 10),
    };
    let shot = null;
    if (input.screenshot !== false) shot = await chrome.screenshot(undefined, { full_page: false });
    const ocrResult = shot && shot.file ? ocr(shot.file) : { available: false, note: 'нема слика' };
    return {
      ok: true, url: page.url, title: page.title, viewport: page.viewport,
      summary, elements: { buttons: (page.buttons || []).length, inputs: (page.inputs || []).length, images: (page.images || []).length, headings: (page.headings || []).length },
      largest_areas: page.largest, tables: page.tables,
      ocr: ocrResult, screenshot: shot && shot.file ? shot.file : null,
      verified: true, verified_how: 'прочитано од живиот DOM во твојот Chrome' + (ocrResult && ocrResult.available && ocrResult.text ? ' + OCR од сликата' : ''),
    };
  } finally { session.close(); }
}
async function visionAsk(input = {}) {
  const page = await describePage({ ...input, screenshot: input.screenshot });
  const question = String(input.question || '').toLowerCase();
  if (!question) return page;
  const hits = [];
  for (const button of page.summary.can_click || []) if (question.split(/\s+/).some((word) => word.length > 3 && String(button).toLowerCase().includes(word))) hits.push({ kind: 'button', text: button });
  const text = String(page.summary.readable_text || '');
  for (const keyword of question.split(/\s+/).filter((w) => w.length > 3)) {
    const index = text.toLowerCase().indexOf(keyword);
    if (index >= 0) hits.push({ kind: 'text', keyword, around: text.slice(Math.max(0, index - 60), index + 120).replace(/\s+/g, ' ') });
  }
  return { ok: true, question: input.question, answer_hits: hits.slice(0, 12), where: page.summary.where, screenshot: page.screenshot, ocr: page.ocr, verified: true, verified_how: 'одговорено од живата страница (DOM + OCR), без надворешен модел' };
}
async function screenDescribe(input = {}) {
  const shot = host.screenshot(input.dir ? host.paths ? input.dir : undefined : undefined);
  const ocrResult = shot && shot.file ? ocr(shot.file) : { available: false };
  return { ok: Boolean(shot && shot.ok), file: shot.file, bytes: shot.bytes, ocr: ocrResult, verified: Boolean(shot && shot.ok), verified_how: 'сликата е зачувана на диск' + (ocrResult.text ? ' и OCR-от прочита текст' : '') };
}
function actions() {
  return [
    { name: 'vision_page', category: 'eyes', description: 'Разбери ја страницата: текст, елементи, копчиња, слика, OCR', params: { url: 'string' }, handler: async (input) => describePage(input) },
    { name: 'vision_ask', category: 'eyes', description: 'Прашај што има на екранот', params: { question: 'string' }, handler: async (input) => visionAsk(input) },
    { name: 'vision_screen', category: 'eyes', description: 'Слика и разбирање на целиот екран (без Chrome)', params: {}, handler: async (input) => screenDescribe(input) },
  ];
}
module.exports = { describePage, visionAsk, screenDescribe, actions, UNDERSTAND, ocr };
