'use strict';
const { readJsonSync, writeJsonSync } = require('../lib/fsx');
const { unique } = require('../lib/textutil');
const config = require('../lib/config').load();
function empty() { return { version: config.version, links: {} }; }
function load() { const data = readJsonSync(config.file.backlinks, null); if (!data || !data.links) return empty(); return { version: config.version, links: data.links }; }
function save(data) { return writeJsonSync(config.file.backlinks, data); }
function link(source, target, reason = 'related', score = null) {
  if (!source || !target || source === target) return null;
  const data = load();
  data.links[source] = data.links[source] || [];
  const existing = data.links[source].find((item) => item.target === target);
  if (existing) { existing.score = score === null ? existing.score : score; return existing; }
  const entry = { target, reason, score, created_at: new Date().toISOString() };
  data.links[source].push(entry);
  save(data);
  return entry;
}
function linkBoth(source, target, reason, score) { const forward = link(source, target, reason, score); link(target, source, reason, score); return forward; }
function autoLink(id, similarHits = []) {
  const settings = config.memory.backlinks;
  const keep = similarHits.filter((hit) => hit.score >= settings.min_similarity).slice(0, settings.max_links);
  for (const hit of keep) linkBoth(id, hit.id, 'similar', hit.score);
  return keep.map((hit) => hit.id);
}
function get(source) { return load().links[source] || []; }
function backlinksFor(target) {
  return Object.entries(load().links).filter(([, links]) => links.some((item) => item.target === target)).map(([source]) => source);
}
function remove(id) {
  const data = load();
  delete data.links[id];
  for (const key of Object.keys(data.links)) data.links[key] = data.links[key].filter((item) => item.target !== id);
  save(data);
  return true;
}
function context(id, depth = 1) {
  const seen = new Set([id]);
  let frontier = [id];
  for (let level = 0; level < depth; level += 1) {
    const next = [];
    for (const node of frontier) {
      for (const item of get(node)) if (!seen.has(item.target)) { seen.add(item.target); next.push(item.target); }
      for (const other of backlinksFor(node)) if (!seen.has(other)) { seen.add(other); next.push(other); }
    }
    frontier = next;
  }
  seen.delete(id);
  return unique([...seen]);
}
function stats() {
  const values = Object.values(load().links);
  return { sources: values.filter((links) => links.length).length, links: values.reduce((total, links) => total + links.length, 0) };
}
module.exports = { load, save, link, linkBoth, autoLink, get, backlinksFor, remove, context, stats };
