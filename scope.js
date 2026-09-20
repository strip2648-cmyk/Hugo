'use strict';
const { fold, tokens, jaccard } = require('./textutil');
function scoreMatch(text, keywordList) {
  const haystack = fold(text);
  const haystackTokens = new Set(tokens(text));
  let score = 0;
  for (const keyword of keywordList || []) {
    const needle = fold(keyword).trim();
    if (!needle) continue;
    if (haystack.includes(needle)) score += needle.includes(' ') ? 2 : 1;
    else if (haystackTokens.has(needle)) score += 1;
  }
  return score;
}
function bestMatch(query, records, options = {}) {
  const keywordField = options.keywords || (() => []);
  const key = options.key || ((record) => JSON.stringify(record));
  const queryTokens = tokens(query);
  const scored = [];
  for (const record of records) {
    const score = scoreMatch(query, keywordField(record)) + jaccard(queryTokens, tokens(key(record))) * 3;
    if (score >= (options.minScore || 1)) scored.push({ record, score: Number(score.toFixed(3)) });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, options.limit || 5);
}
module.exports = { scoreMatch, bestMatch };
