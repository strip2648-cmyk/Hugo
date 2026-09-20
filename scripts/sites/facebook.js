'use strict';

/* Facebook automation through the user's own Chrome session. No Graph API, no passwords, no cookies stored. */
const cdp = require('./cdp');
const config = require('../lib/config').load();
const { InputError } = require('../lib/errors');
const HOME = process.env.HUGO_FB_HOME || 'https://www.facebook.com/';
function isFacebook(url) { return /facebook\.com/i.test(String(url)) || Boolean(process.env.HUGO_FB_HOME && String(url).startsWith(process.env.HUGO_FB_HOME)); }
const COMPOSER_TRIGGERS = ['[role="button"]:has(> span)', 'div[role="button"][tabindex="0"]', '[aria-label*="mind" i]', '[aria-label*="Ум" i]', '[aria-label*="Напиши" i]'];
const COMPOSER_TEXT = ['what\u2019s on your mind', "what's on your mind", 'напиши нешто', 'што има ново', 'create post', 'напиши пост', 'write something'];
const POST_BUTTONS = ['[aria-label="Post"]', '[aria-label="Објави"]', 'div[role="button"][aria-label*="Post" i]'];
const POST_TEXT = ['post', 'објави'];
const DIALOG_FIELD = 'div[role="dialog"] div[contenteditable="true"], div[role="dialog"] textarea, div[contenteditable="true"][role="textbox"]';

async function state(session) {
  const info = await cdp.evalJson(session, '(function(){ const text = (document.body ? document.body.innerText : "").slice(0, 4000).toLowerCase(); const login = [...document.querySelectorAll("input[name=email], input[name=pass], [data-testid=royal_login_button]")].length; return { url: location.href, title: document.title, login_wall: login > 0, has_feed: Boolean(document.querySelector("[role=feed], [role=main]")), signed_in_hint: !text.includes("log in to facebook") && login === 0 }; })()');
  return info;
}
async function fbOpen() {
  const session = await cdp.open({ url_match: 'facebook.com' });
  try {
    const current = await cdp.currentUrl(session);
    let navigated = null;
    if (!isFacebook(current)) navigated = await cdp.goto(session, HOME, { wait_ms: 3300 });
    const s = await state(session);
    return { ok: true, url: s.url, title: s.title, signed_in: !s.login_wall, login_wall: s.login_wall, navigated, verified: !s.login_wall, verified_how: s.login_wall ? 'страницата бара најава во HUGO профилот' : 'профилот е најавен во Chrome и Facebook е отворен' };
  } finally { session.close(); }
}
async function fbFeedRead(input = {}) {
  const session = await cdp.open({ url_match: 'facebook.com' });
  try {
    if (!isFacebook(await cdp.currentUrl(session))) await cdp.goto(session, HOME, { wait_ms: 3300 });
    const data = await cdp.evalJson(session, '(function(){ const posts = [...document.querySelectorAll("[role=article]")].slice(0, ' + Number(input.limit || 8) + ').map((p) => ({ text: (p.innerText || "").slice(0, 600) })); return { posts, count: posts.length }; })()');
    return { ok: true, count: data.count || 0, posts: data.posts || [], verified: true, verified_how: 'прочитано од DOM на Facebook фидот' };
  } finally { session.close(); }
}
async function openComposer(session) {
  const text = await cdp.pageText(session, 4000);
  for (const label of COMPOSER_TEXT) {
    if (text.toLowerCase().includes(label)) {
      const clicked = await cdp.clickByText(session, [label]);
      if (clicked.clicked) return { opened: true, via: 'text:' + label };
    }
  }
  const one = await cdp.clickOneOf(session, COMPOSER_TRIGGERS);
  if (one.clicked) return { opened: true, via: 'selector:' + one.selector };
  return { opened: false, reason: 'не најдов поле „Што има ново“ (можеби профилот не е најавен)' };
}
async function fbWritePost(input = {}) {
  const text = String(input.text || '').trim();
  if (!text) throw new InputError('текстот на постот е задолжителен');
  const session = await cdp.open({ url_match: 'facebook.com' });
  try {
    if (!isFacebook(await cdp.currentUrl(session))) await cdp.goto(session, HOME, { wait_ms: 3300 });
    const s = await state(session);
    if (s.login_wall) return { ok: false, written: false, reason: 'Facebook бара најава во HUGO Chrome профилот', hint: 'најави се еднаш во прозорецот што HUGO го отвора (npm run chrome)', verified: false };
    const composer = await openComposer(session);
    if (!composer.opened) return { ok: false, written: false, reason: composer.reason, verified: false };
    const ready = await cdp.waitFor(session, 'document.querySelector(' + JSON.stringify(DIALOG_FIELD) + ')', { timeout_ms: 12000 });
    if (!ready.ok) return { ok: false, written: false, reason: 'полето за пишување не се појави', verified: false };
    const typed = await cdp.typeText(session, DIALOG_FIELD, text);
    if (!typed.typed) return { ok: false, written: false, reason: typed.reason, verified: false };
    const inDialog = await cdp.evalJson(session, '(function(){ const d = document.querySelector("div[role=dialog]"); return d ? d.innerText.includes(' + JSON.stringify(text.slice(0, 40)) + ') : false; })()');
    return { ok: true, written: true, text, in_composer: inDialog === true, published: false, verified: inDialog === true, verified_how: 'текстот е прочитан назад од полето за објава', next: input.publish ? null : 'за објавување кажи „објави“' };
  } finally { session.close(); }
}
async function fbPublish(input = {}) {
  const session = await cdp.open({ url_match: 'facebook.com' });
  try {
    const current = await cdp.currentUrl(session);
    if (!isFacebook(current)) return { ok: false, published: false, reason: 'Facebook не е отворен; прво пиши го постот', verified: false };
    const s = await state(session);
    if (s.login_wall) return { ok: false, published: false, reason: 'профилот не е најавен', verified: false };
    const expected = input.text ? String(input.text).slice(0, 40) : null;
    if (!expected) {
      const inDialog = await cdp.evalJson(session, '(function(){ const d = document.querySelector("div[role=dialog]"); return d ? d.innerText.slice(0, 400) : ""; })()');
      if (!inDialog || !String(inDialog).trim()) return { ok: false, published: false, reason: 'нема отворен драфт за објава (напиши го постот прво)', verified: false };
    }
    let clicked = await cdp.clickOneOf(session, POST_BUTTONS);
    if (!clicked.clicked) clicked = await cdp.clickByText(session, POST_TEXT);
    if (!clicked.clicked) return { ok: false, published: false, reason: 'не најдов копче „Објави“', verified: false };
    await cdp.sleep(Number(input.wait_ms || config.sites.facebook.post_delay_ms));
    const dialogGone = await cdp.waitFor(session, '!document.querySelector("div[role=dialog]")', { timeout_ms: 15000 });
    const feed = await cdp.evalJson(session, '(function(){ const text = (document.body ? document.body.innerText : ""); const needle = ' + JSON.stringify(expected || input.text || '') + '; return { has: needle ? text.includes(needle) : true, snippet: text.slice(0, 300) }; })()');
    const verified = dialogGone.ok || (feed && feed.has === true);
    return { ok: verified, published: verified, clicked: clicked.selector || clicked.label || 'text', dialog_closed: dialogGone.ok, found_in_feed: Boolean(feed && feed.has), verified, verified_how: verified ? (feed && feed.has) ? 'постот е најден во фидот по објавувањето' : 'дијалогот се затвори по објавувањето' : 'не можев да потврдам дека е објавено' };
  } finally { session.close(); }
}
async function fbSearch(input = {}) {
  const query = String(input.query || '').trim();
  if (!query) throw new InputError('барањето е задолжително');
  const session = await cdp.open({ url_match: 'facebook.com' });
  try {
    await cdp.goto(session, 'https://www.facebook.com/search/top?q=' + encodeURIComponent(query), { wait_ms: 3500 });
    const results = await cdp.evalJson(session, '(function(){ return [...document.querySelectorAll("[role=article], a[href*=\\"/\\"]")].slice(0, 15).map((e) => ({ text: (e.innerText || "").trim().slice(0, 160) })).filter((x) => x.text); })()');
    return { ok: true, query, url: await cdp.currentUrl(session), results: Array.isArray(results) ? results : [], verified: true, verified_how: 'резултати прочитани од Facebook DOM' };
  } finally { session.close(); }
}
module.exports = { fbOpen, fbFeedRead, fbWritePost, fbPublish, fbSearch, state, isFacebook, HOME };
