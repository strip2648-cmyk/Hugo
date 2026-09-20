'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { readJsonlSync, writeJsonlSync, writeJsonSync, ensureDir } = require('../lib/fsx');
const { tokens, jaccard, truncate } = require('../lib/textutil');
const { hashId } = require('../lib/ids');
const config = require('../lib/config').load();
const embed = require('./embed');
const graph = require('./graph');
const temporal = require('./temporal');
const backlinks = require('./backlinks');
const dedupe = require('./dedupe');
function readFacts() {
  const latest = new Map();
  for (const row of readJsonlSync(config.file.facts)) if (row && row.id) latest.set(row.id, row);
  return [...latest.values()];
}
function writeFacts(facts) {
  return writeJsonlSync(config.file.facts, facts.map((fact) => { const clean = { ...fact }; delete clean.vector; return clean; }));
}
async function learn(text, metadata = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('memory.learn needs non-empty text');
  const clean = truncate(text.trim(), 2000);
  const now = new Date().toISOString();
  const facts = readFacts();
  const duplicate = metadata.no_dedupe ? null : dedupe.findDuplicate(clean, facts);
  if (duplicate) {
    const merged = dedupe.mergeFact(duplicate.fact, clean, metadata);
    facts[facts.findIndex((fact) => fact.id === merged.id)] = merged;
    writeFacts(facts);
    embed.add(merged.id, merged.text);
    temporal.record(merged.id, { source: metadata.source || 'user', updated: true, updated_at: now });
    return { fact: merged, updated: true, reason: duplicate.reason };
  }
  const fact = {
    id: hashId(clean), text: clean, tags: metadata.tags || [], source: metadata.source || 'user',
    sources: [metadata.source || 'user'], confidence: metadata.confidence === undefined ? 0.85 : metadata.confidence,
    session: metadata.session || null, raw: metadata.raw || null, revisions: 1, learned_at: now, updated_at: now,
  };
  facts.push(fact);
  writeFacts(facts);
  embed.add(fact.id, fact.text);
  temporal.record(fact.id, { source: fact.source, learned_at: now, updated_at: now });
  graph.ingestFact(fact);
  const similar = embed.similarTo(fact.id, { limit: 6 });
  backlinks.autoLink(fact.id, similar);
  return { fact, updated: false, similar: similar.slice(0, 3) };
}
function recencyScore(learnedAt) {
  const half = config.memory.recall.half_life_days * 86400000;
  const age = Date.now() - Date.parse(learnedAt || 0);
  if (!Number.isFinite(age) || age < 0) return 1;
  return Number(Math.pow(0.5, age / half).toFixed(4));
}
function recall(query, options = {}) {
  if (typeof query !== 'string' || !query.trim()) throw new Error('memory.recall needs a non-empty query');
  const settings = { ...config.memory.recall, ...(options.weights || {}) };
  const limit = options.limit || settings.limit;
  const facts = readFacts();
  if (!facts.length) return { query, hits: [], total_facts: 0, strategy: 'hybrid(none)' };
  const queryTokens = tokens(query);
  const vectorHits = new Map(embed.similar(query, { limit: Math.max(limit * 4, 20), min: 0.01 }).map((hit) => [hit.id, hit.score]));
  const hits = [];
  for (const fact of facts) {
    if (options.tag && !(fact.tags || []).includes(options.tag)) continue;
    if (options.before && !(fact.learned_at <= options.before)) continue;
    const vector = vectorHits.get(fact.id) || 0;
    const lexical = jaccard(queryTokens, tokens(fact.text));
    const keyword = queryTokens.length ? queryTokens.filter((token) => fact.text.toLowerCase().includes(token)).length / queryTokens.length : 0;
    const recency = recencyScore(fact.learned_at);
    const score = settings.vector_weight * vector + settings.keyword_weight * Math.max(lexical, keyword * 0.6) + settings.recency_weight * recency * (vector > 0.05 ? 1 : 0.4);
    if (score < settings.min_score) continue;
    hits.push({
      id: fact.id, text: fact.text, tags: fact.tags || [], source: fact.source, learned_at: fact.learned_at,
      updated_at: fact.updated_at, revisions: fact.revisions || 1, score: Number(score.toFixed(4)),
      signals: { vector: Number(vector.toFixed(4)), lexical: Number(lexical.toFixed(4)), keyword: Number(keyword.toFixed(4)), recency },
      links: backlinks.get(fact.id).map((item) => item.target),
      entities: (graph.load().facts[fact.id] || []).slice(0, 5),
    });
  }
  return { query, hits: hits.sort((a, b) => b.score - a.score).slice(0, limit), total_facts: facts.length, strategy: 'hybrid(vector+keyword+recency)' };
}
function context(query, options = {}) {
  const result = recall(query, { limit: options.limit || 5, ...options });
  if (!result.hits.length) return { text: '', hits: [] };
  const lines = result.hits.map((hit) => `- (${String(hit.learned_at).slice(0, 10)}) ${hit.text}`);
  const entities = new Set();
  for (const hit of result.hits) for (const entity of hit.entities || []) entities.add(entity);
  return { text: `\u0417\u043d\u0430\u043c \u0437\u0430 \u043e\u0432\u0430:\n${lines.join('\n')}`, hits: result.hits, entities: [...entities] };
}
function get(id) { return readFacts().find((fact) => fact.id === id) || null; }
function list(options = {}) {
  let facts = readFacts();
  if (options.tag) facts = facts.filter((fact) => (fact.tags || []).includes(options.tag));
  if (options.since) facts = facts.filter((fact) => fact.updated_at >= options.since);
  return facts.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, options.limit || 50);
}
function forget(id) {
  const facts = readFacts();
  const remaining = facts.filter((fact) => fact.id !== id);
  if (remaining.length === facts.length) return { forgotten: false, id };
  writeFacts(remaining);
  embed.remove(id); temporal.forget(id); backlinks.remove(id); graph.forgetFact(id);
  return { forgotten: true, id };
}
async function update(id, changes = {}) {
  const fact = get(id);
  if (!fact) throw new Error(`fact not found: ${id}`);
  const next = {
    ...fact,
    ...changes,
    id,
    text: changes.text ? truncate(String(changes.text).trim(), 2000) : fact.text,
    tags: changes.tags || fact.tags || [],
    source: changes.source || fact.source || 'update',
    updated_at: new Date().toISOString(),
    revisions: (fact.revisions || 1) + 1,
  };
  writeFacts(readFacts().map((item) => (item.id === id ? next : item)));
  embed.add(id, next.text);
  temporal.record(id, { source: next.source, updated: true, updated_at: next.updated_at });
  graph.forgetFact(id);
  graph.ingestFact(next);
  const similar = embed.similarTo(id, { limit: 6 });
  backlinks.remove(id);
  backlinks.autoLink(id, similar);
  return { fact: next, updated: true };
}
function enforceRetention(days = null) {
  const retention = days || config.memory.retention_days;
  const result = require('./conversations').prune(retention);
  const learned = readJsonlSync(config.file.learned);
  const cutoff = Date.now() - retention * 86400000;
  const keep = learned.filter((row) => Date.parse(row.at || row.created_at || 0) >= cutoff);
  if (keep.length !== learned.length) writeJsonlSync(config.file.learned, keep);
  return { ...result, learned_removed: learned.length - keep.length };
}
function exportBundle() {
  const map = {
    facts: config.file.facts, conversations: config.file.conversations, learned: config.file.learned, notes: config.file.notes,
    habits: config.file.habits, todos: config.file.todos, journal: config.file.journal, graph: config.file.graph,
    temporal: config.file.temporal, backlinks: config.file.backlinks, crm: config.file.crm, campaigns: config.file.campaigns, schedules: config.file.schedules,
  };
  const bundle = { version: config.version, exported_at: new Date().toISOString(), files: {} };
  for (const [name, file] of Object.entries(map)) {
    if (!fs.existsSync(file)) { bundle.files[name] = file.endsWith('.jsonl') ? [] : {}; continue; }
    const raw = fs.readFileSync(file, 'utf8');
    bundle.files[name] = file.endsWith('.jsonl')
      ? raw.split('\n').filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean)
      : JSON.parse(raw || '{}');
  }
  bundle.counts = { facts: (bundle.files.facts || []).length, conversations: (bundle.files.conversations || []).length };
  return bundle;
}
async function importBundle(bundle, options = {}) {
  if (!bundle || !bundle.files) throw new Error('invalid memory bundle');
  const report = { facts: { added: 0, updated: 0 }, restored: [] };
  for (const fact of bundle.files.facts || []) {
    if (!fact || !fact.text) continue;
    const result = await learn(fact.text, { source: fact.source || 'import', tags: fact.tags || [], confidence: fact.confidence, no_dedupe: Boolean(options.force) });
    if (result.updated) report.facts.updated += 1; else report.facts.added += 1;
  }
  for (const [name, value] of Object.entries(bundle.files)) {
    if (name === 'facts') continue;
    const file = config.file[name];
    if (!file) continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      const existing = readJsonlSync(file);
      const seen = new Set(existing.map((row) => JSON.stringify(row)));
      for (const row of value) if (!seen.has(JSON.stringify(row))) existing.push(row);
      writeJsonlSync(file, existing);
      report.restored.push({ file: path.basename(file), rows: existing.length });
    } else if (value && typeof value === 'object' && Object.keys(value).length) {
      writeJsonSync(file, value);
      report.restored.push({ file: path.basename(file) });
    }
  }
  rebuildIndexes();
  return report;
}
function rebuildIndexes() {
  const facts = readFacts();
  embed.rebuild(facts);
  for (const fact of facts) graph.ingestFact(fact);
  return { facts: facts.length };
}
function stats() {
  const facts = readFacts();
  const byTag = {};
  for (const fact of facts) for (const tag of fact.tags || ['untagged']) byTag[tag] = (byTag[tag] || 0) + 1;
  return {
    version: config.version, facts: facts.length, by_tag: byTag,
    embeddings: embed.stats(), graph: graph.stats(), temporal: temporal.stats(), backlinks: backlinks.stats(),
    conversations: require('./conversations').stats(),
    files: { facts: path.relative(config.root, config.file.facts), size_bytes: fs.existsSync(config.file.facts) ? fs.statSync(config.file.facts).size : 0 },
    retention_days: config.memory.retention_days,
  };
}
function ensureStorage() {
  ensureDir(config.dir.memory);
  for (const file of [config.file.facts, config.file.conversations, config.file.learned, config.file.journal]) if (!fs.existsSync(file)) fs.writeFileSync(file, '', 'utf8');
  return true;
}
module.exports = { learn, recall, context, get, list, forget, update, stats, exportBundle, importBundle, enforceRetention, rebuildIndexes, ensureStorage, readFacts, writeFacts };
