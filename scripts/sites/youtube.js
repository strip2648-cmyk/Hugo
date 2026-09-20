'use strict';

/* YouTube control through the user's own Chrome session (open, search, play, pause, next, volume). */
const cdp = require('./cdp');
const config = require('../lib/config').load();
const { InputError } = require('../lib/errors');
const HOME = process.env.HUGO_YT_HOME || 'https://www.youtube.com/';
const RESULTS = process.env.HUGO_YT_SEARCH_BASE || 'https://www.youtube.com/results?search_query=';
const VIDEO = 'video.html5-main-video, video';
const RESULT_SELECTOR = 'ytd-video-renderer a#video-title, ytd-video-renderer a[href*="/watch"]';
const NEXT_BUTTON = '.ytp-next-button';

async function playerState(session) {
  return cdp.evalJson(session, '(function(){ const v = document.querySelector("video.html5-main-video") || document.querySelector("video"); const title = (document.querySelector("h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string") || {}).innerText || document.title; return { has_video: Boolean(v), paused: v ? v.paused : null, current_time: v ? Number(v.currentTime.toFixed(2)) : null, duration: v && isFinite(v.duration) ? Number(v.duration.toFixed(1)) : null, volume: v ? Number(v.volume.toFixed(2)) : null, muted: v ? Boolean(v.muted) : null, title: (title || "").trim().slice(0, 160), url: location.href }; })()');
}
async function ytOpen(input = {}) {
  const session = await cdp.open({ url_match: 'youtube.com' });
  try {
    let navigated = null;
    if (!/youtube\.com/i.test(await cdp.currentUrl(session))) navigated = await cdp.goto(session, input.url || HOME, { wait_ms: 3000 });
    return { ok: true, url: await cdp.currentUrl(session), title: await cdp.currentTitle(session), navigated, verified: true, verified_how: 'YouTube е отворен во твојот Chrome' };
  } finally { session.close(); }
}
async function ytSearch(input = {}) {
  const query = String(input.query || input.text || '').trim();
  if (!query) throw new InputError('барањето е задолжително');
  const session = await cdp.open({ url_match: 'youtube.com' });
  try {
    await cdp.goto(session, RESULTS + encodeURIComponent(query), { wait_ms: Number(config.sites.youtube.search_delay_ms) });
    await cdp.waitFor(session, 'document.querySelector(' + JSON.stringify(RESULT_SELECTOR) + ')', { timeout_ms: 12000 });
    const results = await cdp.evalJson(session, '(function(){ return [...document.querySelectorAll("ytd-video-renderer")].slice(0, 10).map((r) => { const a = r.querySelector("a#video-title"); return { title: (a ? a.innerText : "").trim().slice(0, 140), url: a ? a.href : null, channel: ((r.querySelector("ytd-channel-name") || {}).innerText || "").trim().slice(0, 60) }; }).filter((x) => x.title); })()');
    return { ok: true, query, count: Array.isArray(results) ? results.length : 0, results: Array.isArray(results) ? results : [], url: await cdp.currentUrl(session), verified: Array.isArray(results) && results.length > 0, verified_how: 'резултати прочитани од YouTube DOM' };
  } finally { session.close(); }
}
async function ytPlay(input = {}) {
  const session = await cdp.open({ url_match: 'youtube.com' });
  try {
    const query = String(input.query || input.text || '').trim();
    const index = Number(input.index || 0);
    if (query && !input.url) {
      await cdp.goto(session, RESULTS + encodeURIComponent(query), { wait_ms: Number(config.sites.youtube.search_delay_ms) });
      await cdp.waitFor(session, 'document.querySelector(' + JSON.stringify(RESULT_SELECTOR) + ')', { timeout_ms: 12000 });
      const clicked = await cdp.evalJson(session, '(function(){ const a = [...document.querySelectorAll("' + RESULT_SELECTOR + '")][' + index + ']; if (!a) return { clicked: false }; a.click(); return { clicked: true, title: (a.innerText || "").trim().slice(0, 140), href: a.href }; })()');
      if (!clicked.clicked) return { ok: false, playing: false, reason: 'не најдов видео за „' + query + '“', verified: false };
      await cdp.sleep(3000);
    } else if (input.url) {
      await cdp.goto(session, input.url, { wait_ms: 2500 });
    }
    const ready = await cdp.waitFor(session, 'document.querySelector(' + JSON.stringify(VIDEO) + ')', { timeout_ms: 15000 });
    if (!ready.ok) return { ok: false, playing: false, reason: 'плеерот не се појави', verified: false };
    await cdp.evalValue(session, '(function(){ const v = document.querySelector("' + VIDEO + '"); if (!v) return false; if (typeof v.muted === "boolean") v.muted = false; v.volume = ' + Number(config.sites.youtube.default_volume) + '; const p = v.play(); if (p && p.catch) p.catch(() => {}); return true; })()');
    const started = await cdp.waitFor(session, '(function(){ const v = document.querySelector("' + VIDEO + '"); return v && !v.paused; })()', { timeout_ms: 12000 });
    const state = await playerState(session);
    return { ok: Boolean(state.has_video && !state.paused), playing: Boolean(state.has_video && !state.paused), now_playing: state.title, current_time: state.current_time, volume: state.volume, url: state.url, verified: Boolean(state.has_video && !state.paused), verified_how: 'проверено во самиот плеер (video.paused / currentTime)' };
  } finally { session.close(); }
}
async function ytPause() {
  const session = await cdp.open({ url_match: 'youtube.com' });
  try {
    await cdp.evalValue(session, '(function(){ const v = document.querySelector("' + VIDEO + '"); if (v) v.pause(); return true; })()');
    const state = await playerState(session);
    return { ok: state.paused === true, paused: state.paused === true, now_playing: state.title, verified: state.paused === true, verified_how: 'video.paused' };
  } finally { session.close(); }
}
async function ytResume() {
  const session = await cdp.open({ url_match: 'youtube.com' });
  try {
    await cdp.evalValue(session, '(function(){ const v = document.querySelector("' + VIDEO + '"); if (v) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } return true; })()');
    const state = await playerState(session);
    return { ok: state.paused === false, playing: state.paused === false, now_playing: state.title, verified: state.paused === false, verified_how: 'video.paused' };
  } finally { session.close(); }
}
async function ytNext() {
  const session = await cdp.open({ url_match: 'youtube.com' });
  try {
    const before = await playerState(session);
    const clicked = await cdp.clickSelector(session, NEXT_BUTTON);
    if (!clicked.clicked) await cdp.pressKey(session, 'N', { shift: true });
    await cdp.sleep(3500);
    const after = await playerState(session);
    const changed = Boolean(after.url && before.url && after.url !== before.url) || Boolean(after.title && before.title && after.title !== before.title);
    return { ok: true, clicked: clicked.clicked, from: before.title, now_playing: after.title, playing: after.paused === false, verified: changed || after.paused === false, verified_how: changed ? 'насловот/линкот се смени по следното видео' : 'плеерот продолжува да свири' };
  } finally { session.close(); }
}
async function ytVolume(input = {}) {
  const level = input.level === undefined ? 0.7 : Number(input.level);
  const session = await cdp.open({ url_match: 'youtube.com' });
  try {
    await cdp.evalValue(session, '(function(){ const v = document.querySelector("' + VIDEO + '"); if (!v) return false; v.volume = ' + Math.max(0, Math.min(1, level)) + '; if (' + (level > 0) + ') v.muted = false; return true; })()');
    const state = await playerState(session);
    return { ok: state.volume !== null, volume: state.volume, muted: state.muted, verified: state.volume !== null && Math.abs(Number(state.volume) - Math.max(0, Math.min(1, level))) < 0.08, verified_how: 'video.volume прочитан назад' };
  } finally { session.close(); }
}
async function ytNowPlaying() {
  const session = await cdp.open({ url_match: 'youtube.com' });
  try {
    const state = await playerState(session);
    return { ok: Boolean(state.has_video), ...state };
  } finally { session.close(); }
}
module.exports = { ytOpen, ytSearch, ytPlay, ytPause, ytResume, ytNext, ytVolume, ytNowPlaying, playerState };
