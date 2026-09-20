'use strict';
const { tokens, jaccard, fold } = require('../lib/textutil');
const { cosine } = require('../lib/vec');
const embed = require('./embed');
const config = require('../lib/config').load();
function containment(left, right) {
  const a = fold(left).replace(/\s+/g, ' ').trim(); const b = fold(right).replace(/\s+/g, ' ').trim();
  if (!a || !b) return 0;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length < 12 || !longer.includes(shorter)) return 0;
  return Number((shorter.length / longer.length).toFixed(3));
}
function findDuplicate(text, facts) {
  const settings = config.memory.dedupe;
  const query = embed.vectorFor(text);
  const scored = facts.map((fact) => ({ fact, vector: cosine(query, embed.get(fact.id) || []), lexical: jaccard(tokens(text), tokens(fact.text)), contained: containment(text, fact.text) }));
  scored.sort((a, b) => b.vector - a.vector);
  const hit = scored.slice(0, 30).find((item) => item.vector >= settings.cosine || item.lexical >= settings.jaccard || item.contained >= 0.6);
  if (!hit) return null;
  const reason = hit.vector >= settings.cosine ? 'semantic' : (hit.contained >= 0.6 ? 'containment' : 'lexical');
  return { fact: hit.fact, scores: { vector: hit.vector, lexical: hit.lexical, containment: hit.contained }, reason };
}
function mergeFact(previous, text, metadata = {}) {
  const now = new Date().toISOString();
  const nextText = String(text).trim();
  return {
    ...previous,
    text: nextText.length > previous.text.length ? nextText : previous.text,
    tags: [...new Set([...(previous.tags || []), ...(metadata.tags || [])])],
    confidence: Math.max(previous.confidence || 0.5, metadata.confidence === undefined ? 0.7 : metadata.confidence),
    sources: [...new Set([...(previous.sources || [previous.source]).filter(Boolean), metadata.source || 'user'])],
    updated_at: now,
    revisions: (previous.revisions || 1) + 1,
  };
}
module.exports = { findDuplicate, mergeFact, containment };
