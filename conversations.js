'use strict';
const path = require('node:path');
const { readJsonlSync, appendJsonlSync, writeJsonlSync, readJsonSync, writeJsonSync } = require('../lib/fsx');
const { sentences, truncate } = require('../lib/textutil');
const config = require('../lib/config').load();
const RULES = [
  { tag: 'identity', pattern: /(\u0441\u0435 \u0432\u0438\u043a\u0430\u043c|\u0438\u043c\u0435\u0442\u043e \u043c\u0438 \u0435|my name is|i am)\s+(.{3,80})/i },
  { tag: 'preference', pattern: /(\u0441\u0430\u043a\u0430\u043c|\u043f\u0440\u0435\u0444\u0435\u0440\u0438\u0440\u0430\u043c|i prefer|i like)\s+(.{3,120})/i },
  { tag: 'dislike', pattern: /(\u043d\u0435 \u0441\u0430\u043a\u0430\u043c|\u043d\u0435 \u043c\u0438 \u0441\u0435 \u0434\u043e\u043f\u0430\u0453\u0430|i dislike|i hate)\s+(.{3,120})/i },
  { tag: 'work', pattern: /(\u0440\u0430\u0431\u043e\u0442\u0430\u043c|\u043c\u043e\u0458\u0430\u0442\u0430 \u0440\u0430\u0431\u043e\u0442\u0430|my job is|i work as|i work at)\s+(.{3,120})/i },
  { tag: 'goal', pattern: /(\u0446\u0435\u043b\u0442\u0430 \u043c\u0438 \u0435|\u043c\u043e\u0458\u0430\u0442\u0430 \u0446\u0435\u043b|my goal is|i want to)\s+(.{3,160})/i },
  { tag: 'decision', pattern: /(\u0440\u0435\u0448\u0438\u0432|\u043e\u0434\u043b\u0443\u0447\u0438\u0432|decided to|i will)\s+(.{3,160})/i },
  { tag: 'explicit', pattern: /(\u0437\u0430\u043f\u043e\u043c\u043d\u0438|remember that|remember)\s+(.{3,200})/i },
  { tag: 'task', pattern: /(\u0442\u0440\u0435\u0431\u0430 \u0434\u0430|remind me to|\u043c\u043e\u0440\u0430\u043c \u0434\u0430)\s+(.{3,160})/i },
];
function append(entry) { const record = { at: new Date().toISOString(), session: entry.session || 'default', ...entry }; appendJsonlSync(config.file.conversations, record); return record; }
function recent(limit = 20) { return readJsonlSync(config.file.conversations, limit); }
function sessions() {
  const map = new Map();
  for (const row of readJsonlSync(config.file.conversations)) {
    const key = row.session || 'default';
    const current = map.get(key) || { session: key, first: row.at, last: row.at, messages: 0 };
    current.last = row.at; current.messages += 1;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => String(b.last).localeCompare(String(a.last)));
}
function extractFacts(text, options = {}) {
  const found = [];
  for (const sentence of sentences(text)) {
    for (const rule of RULES) {
      const match = sentence.match(rule.pattern);
      if (!match) continue;
      const value = truncate(match[2], 200);
      if (value.length < 4) continue;
      found.push({ text: sentence.trim(), value, tag: rule.tag, source: options.source || 'conversation', session: options.session || 'default' });
      break;
    }
  }
  return found;
}
function state() { return readJsonSync(config.file.state, { processed_conversations: 0, last_ingest: null }); }
function saveState(next) { return writeJsonSync(config.file.state, next); }
async function ingest(options = {}) {
  const store = require('./store');
  const rows = readJsonlSync(config.file.conversations);
  const current = state();
  const start = options.all ? 0 : current.processed_conversations || 0;
  const slice = rows.slice(start).slice(0, options.maxLines || rows.length);
  let learned = 0; let updated = 0;
  const facts = [];
  for (const row of slice) {
    if (!row || !row.text || row.role === 'system') continue;
    for (const candidate of extractFacts(row.text, { session: row.session })) {
      const result = await store.learn(candidate.value, { source: 'conversation', tags: ['conversation', candidate.tag], confidence: 0.7, session: row.session, raw: candidate.text });
      if (result.updated) updated += 1; else learned += 1;
      facts.push({ id: result.fact.id, tag: candidate.tag, value: candidate.value });
    }
  }
  saveState({ ...current, processed_conversations: options.all ? rows.length : start + slice.length, last_ingest: new Date().toISOString() });
  return { scanned: slice.length, learned, updated, facts };
}
function prune(days = null) {
  const retention = days || config.memory.retention_days;
  const cutoff = Date.now() - retention * 86400000;
  const rows = readJsonlSync(config.file.conversations);
  const keep = rows.filter((row) => Date.parse(row.at || row.created_at || 0) >= cutoff);
  if (keep.length !== rows.length) writeJsonlSync(config.file.conversations, keep);
  return { removed: rows.length - keep.length, kept: keep.length, retention_days: retention };
}
function stats() {
  const rows = readJsonlSync(config.file.conversations);
  const types = {};
  for (const row of rows) { const key = row.type || row.role || 'unknown'; types[key] = (types[key] || 0) + 1; }
  return { messages: rows.length, sessions: sessions().length, types, file: path.relative(config.root, config.file.conversations) };
}
module.exports = { append, recent, sessions, extractFacts, ingest, prune, stats, RULES };
