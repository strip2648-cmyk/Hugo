'use strict';
const { readJsonSync, writeJsonSync } = require('../lib/fsx');
const { slugify, unique, fold } = require('../lib/textutil');
const config = require('../lib/config').load();
function empty() { return { version: config.version, entities: {}, relationships: [], facts: {}, updated_at: null }; }
function load() {
  const graph = readJsonSync(config.file.graph, null);
  if (!graph || !graph.entities) return empty();
  return { ...empty(), ...graph, entities: graph.entities || {}, relationships: graph.relationships || [] };
}
function save(graph) { graph.updated_at = new Date().toISOString(); return writeJsonSync(config.file.graph, graph); }
function entityId(label) { return slugify(String(label).trim().toLowerCase()); }
function addEntity(entity) {
  const label = entity.label || entity.name || entity.id;
  if (!label) throw new Error('graph.addEntity needs a label');
  const graph = load();
  const id = entity.id ? slugify(entity.id) : entityId(label);
  const previous = graph.entities[id] || {};
  graph.entities[id] = {
    id, label: entity.label || previous.label || label, type: entity.type || previous.type || 'concept',
    mentions: (previous.mentions || 0) + (entity.mentions || 1),
    first_seen: previous.first_seen || new Date().toISOString(), updated_at: new Date().toISOString(),
    source_facts: unique([...(previous.source_facts || []), ...(entity.source ? [entity.source] : [])]),
  };
  save(graph);
  return graph.entities[id];
}
function relate(from, relation, to, meta = {}) {
  const graph = load();
  const source = slugify(from); const target = slugify(to);
  const existing = graph.relationships.find((edge) => edge.from === source && edge.relation === relation && edge.to === target);
  if (existing) { existing.weight = (existing.weight || 1) + 1; existing.updated_at = new Date().toISOString(); }
  else graph.relationships.push({ from: source, relation, to: target, weight: 1, ...meta, created_at: new Date().toISOString() });
  save(graph);
  return { from: source, relation, to: target };
}
function query(id) {
  const graph = load();
  const key = slugify(id);
  return {
    entity: graph.entities[key] || null,
    relations: graph.relationships.filter((edge) => edge.from === key || edge.to === key)
      .map((edge) => ({ direction: edge.from === key ? 'out' : 'in', relation: edge.relation, other: edge.from === key ? edge.to : edge.from, weight: edge.weight })),
  };
}
function neighbors(id, depth = 1) {
  const graph = load();
  const start = slugify(id);
  const seen = new Set([start]);
  let frontier = [start];
  for (let level = 0; level < depth; level += 1) {
    const next = [];
    for (const edge of graph.relationships) {
      if (frontier.includes(edge.from) && !seen.has(edge.to)) { seen.add(edge.to); next.push(edge.to); }
      if (frontier.includes(edge.to) && !seen.has(edge.from)) { seen.add(edge.from); next.push(edge.from); }
    }
    frontier = next;
  }
  seen.delete(start);
  return [...seen].map((key) => graph.entities[key] || { id: key, label: key });
}
const SKIP = new Set(['The', 'This', 'That', 'And', 'But', 'If', 'Then']);
function extractEntities(text) {
  const found = new Map();
  const source = String(text || '');
  for (const match of source.matchAll(/(?<![\p{L}\p{N}])(\p{Lu}[\p{L}\p{N}]{2,}(?:\s+\p{Lu}[\p{L}\p{N}]{2,}){0,2})(?![\p{L}\p{N}])/gu)) {
    const label = match[1].trim();
    if (SKIP.has(label) || label.length < 3) continue;
    if (['hugo', 'jarvis'].includes(fold(label).trim())) continue;
    found.set(entityId(label), { label, type: 'proper-noun' });
  }
  for (const match of source.matchAll(/(^|\s)(@[a-zA-Z0-9_.]{3,})/g)) found.set(entityId(match[2]), { label: match[2], type: 'handle' });
  for (const match of source.matchAll(/\b([a-z0-9.-]+\.(?:com|net|org|io|mk|ai|dev|app|edu|gov))\b/gi)) found.set(entityId(match[1]), { label: match[1], type: 'domain' });
  for (const match of source.matchAll(/\b#(\p{L}[\p{L}\p{N}_]{2,})/gu)) found.set(entityId(match[0]), { label: match[0], type: 'hashtag' });
  return [...found.values()];
}
function ingestFact(fact) {
  const entities = extractEntities(fact.text);
  for (const entity of entities) addEntity({ ...entity, source: fact.id });
  const graph = load();
  for (const entity of entities) graph.facts[fact.id] = unique([...(graph.facts[fact.id] || []), entityId(entity.label)]);
  for (let left = 0; left < entities.length; left += 1) {
    for (let right = left + 1; right < entities.length; right += 1) relate(entityId(entities[left].label), 'appears_with', entityId(entities[right].label), { source_fact: fact.id });
  }
  for (const entity of entities) relate(fact.id, 'mentions', entityId(entity.label));
  save(graph);
  return entities.map((entity) => entityId(entity.label));
}
function forgetFact(factId) {
  const graph = load();
  delete graph.facts[factId];
  graph.relationships = graph.relationships.filter((edge) => edge.from !== factId && edge.to !== factId);
  save(graph);
  return true;
}
function searchEntities(term, limit = 10) {
  const needle = fold(term);
  const graph = load();
  return Object.values(graph.entities)
    .map((entity) => ({ entity, score: fold(entity.label).includes(needle) ? (entity.mentions || 1) + 2 : 0 }))
    .filter((row) => row.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((row) => row.entity);
}
function stats() {
  const graph = load();
  const byType = {};
  for (const entity of Object.values(graph.entities)) byType[entity.type] = (byType[entity.type] || 0) + 1;
  return { entities: Object.keys(graph.entities).length, relationships: graph.relationships.length, facts_linked: Object.keys(graph.facts).length, by_type: byType, updated_at: graph.updated_at };
}
function summary(id) {
  const result = query(id);
  if (!result.entity) return null;
  return { entity: result.entity.label, type: result.entity.type, mentions: result.entity.mentions, relations: result.relations.map((relation) => `${relation.direction === 'out' ? '->' : '<-'} ${relation.relation} ${relation.other}`).slice(0, 12) };
}
module.exports = { load, save, addEntity, relate, query, neighbors, extractEntities, ingestFact, forgetFact, searchEntities, stats, summary, entityId };
