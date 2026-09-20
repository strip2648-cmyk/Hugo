'use strict';
const { readJsonSync, writeJsonSync } = require('../lib/fsx');
const { vectorize, cosine, updateStats, DIM } = require('../lib/vec');
const config = require('../lib/config').load();
function empty() { return { version: config.version, dim: DIM, total: 0, df: {}, vectors: {} }; }
function loadIndex() {
  const index = readJsonSync(config.file.embedIndex, null);
  if (!index || !index.vectors) return empty();
  return { ...empty(), ...index, vectors: index.vectors || {}, df: index.df || {} };
}
function saveIndex(index) { return writeJsonSync(config.file.embedIndex, index); }
function add(id, text) {
  const index = loadIndex();
  if (index.vectors[id]) { index.vectors[id] = vectorize(text, index); saveIndex(index); return index.vectors[id]; }
  const vector = vectorize(text, index);
  const stats = updateStats({ total: index.total, df: index.df }, text);
  index.vectors[id] = vector; index.total = stats.total; index.df = stats.df;
  saveIndex(index);
  return vector;
}
function remove(id) { const index = loadIndex(); if (!index.vectors[id]) return false; delete index.vectors[id]; saveIndex(index); return true; }
function vectorFor(text) { return vectorize(text, loadIndex()); }
function get(id) { return loadIndex().vectors[id] || null; }
function similar(text, options = {}) {
  const exclude = new Set(options.exclude || []);
  const index = loadIndex();
  const query = vectorize(text, index);
  const hits = [];
  for (const [id, vector] of Object.entries(index.vectors)) {
    if (exclude.has(id)) continue;
    const score = cosine(query, vector);
    if (score >= (options.min === undefined ? 0 : options.min) && score > 0) hits.push({ id, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, options.limit || 10);
}
function similarTo(id, options = {}) {
  const index = loadIndex();
  const source = index.vectors[id];
  if (!source) return [];
  return Object.entries(index.vectors).filter(([other]) => other !== id)
    .map(([other, vector]) => ({ id: other, score: cosine(source, vector) }))
    .filter((hit) => hit.score > 0).sort((a, b) => b.score - a.score).slice(0, options.limit || 10);
}
function stats() {
  const index = loadIndex();
  return { dim: index.dim, vectors: Object.keys(index.vectors).length, corpus: index.total, terms: Object.keys(index.df).length };
}
function rebuild(facts) {
  const index = empty();
  for (const fact of facts) {
    const vector = vectorize(fact.text, index);
    const next = updateStats({ total: index.total, df: index.df }, fact.text);
    index.vectors[fact.id] = vector; index.total = next.total; index.df = next.df;
  }
  saveIndex(index);
  return stats();
}
module.exports = { add, remove, get, vectorFor, similar, similarTo, stats, rebuild, loadIndex, saveIndex };
