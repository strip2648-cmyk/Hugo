'use strict';
const { readJsonSync, writeJsonSync } = require('../lib/fsx');
const config = require('../lib/config').load();
function empty() { return { version: config.version, entries: {} }; }
function load() {
  const data = readJsonSync(config.file.temporal, null);
  if (!data) return empty();
  if (data.facts && !data.entries) return { version: config.version, entries: data.facts };
  return { ...empty(), ...data, entries: data.entries || {} };
}
function save(data) { return writeJsonSync(config.file.temporal, data); }
function record(id, info = {}) {
  const data = load();
  const now = new Date().toISOString();
  const previous = data.entries[id] || {};
  data.entries[id] = {
    learned_at: previous.learned_at || info.learned_at || now,
    updated_at: info.updated_at || now,
    supersedes: info.supersedes || previous.supersedes || null,
    source: info.source || previous.source || 'unknown',
    revision: (previous.revision || 1) + (info.updated ? 1 : 0),
  };
  save(data);
  return data.entries[id];
}
function when(id) { return load().entries[id] || null; }
function forget(id) { const data = load(); const had = Boolean(data.entries[id]); delete data.entries[id]; save(data); return had; }
function search(options = {}) {
  return Object.entries(load().entries).map(([id, value]) => ({ id, ...value }))
    .filter((entry) => {
      if (options.before && !(entry.learned_at <= options.before)) return false;
      if (options.after && !(entry.learned_at >= options.after)) return false;
      if (options.updatedAfter && !(entry.updated_at >= options.updatedAfter)) return false;
      return true;
    })
    .sort((a, b) => String(b.learned_at).localeCompare(String(a.learned_at)))
    .slice(0, options.limit || 50);
}
function changedSince(timestamp) { return search({ updatedAfter: timestamp, limit: 200 }); }
function timeline(limit = 20) { return search({ limit }); }
function stats() {
  const entries = Object.values(load().entries);
  const dates = entries.map((entry) => entry.learned_at).filter(Boolean).sort();
  return { tracked: entries.length, oldest: dates[0] || null, newest: dates[dates.length - 1] || null };
}
module.exports = { load, save, record, when, forget, search, changedSince, timeline, stats };
