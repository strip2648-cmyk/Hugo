'use strict';
const { tokens, ngrams } = require('./textutil');
const DIM = 256;
function hashTerm(term) {
  let hash = 2166136261;
  for (let index = 0; index < term.length; index += 1) { hash ^= term.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return Math.abs(hash);
}
function terms(text) { const list = tokens(text); return [...list, ...ngrams(list, 2)]; }
function termFrequency(text) { const counts = new Map(); for (const term of terms(text)) counts.set(term, (counts.get(term) || 0) + 1); return counts; }
function vectorize(text, stats = null) {
  const counts = termFrequency(text);
  const vector = new Array(DIM).fill(0);
  const total = stats && stats.total ? stats.total : 1;
  const df = (stats && stats.df) || {};
  for (const [term, count] of counts.entries()) {
    const tf = 1 + Math.log(count);
    const idf = Math.log((total + 1) / ((df[term] || 0) + 1)) + 1;
    vector[hashTerm(term) % DIM] += tf * idf;
  }
  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm) || 1;
  return vector.map((value) => Number((value / norm).toFixed(8)));
}
function cosine(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || !left.length) return 0;
  let dot = 0; let leftNorm = 0; let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) { dot += left[index] * right[index]; leftNorm += left[index] * left[index]; rightNorm += right[index] * right[index]; }
  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return denominator ? Number((dot / denominator).toFixed(6)) : 0;
}
function updateStats(stats, text) {
  const next = { dim: DIM, total: (stats && stats.total) || 0, df: { ...((stats && stats.df) || {}) } };
  const uniqueTerms = new Set(terms(text));
  if (uniqueTerms.size) next.total += 1;
  for (const term of uniqueTerms) next.df[term] = (next.df[term] || 0) + 1;
  return next;
}
module.exports = { DIM, vectorize, cosine, updateStats, terms, hashTerm };
