'use strict';
const config = require('../lib/config').load();
const { readJsonSync } = require('../lib/fsx');
const { bestMatch } = require('../lib/scope');
const { truncate, keywords } = require('../lib/textutil');
function intents() { return (readJsonSync(config.file.intents, { intents: [] }).intents) || []; }
function routeIntent(text, options = {}) {
  const hits = bestMatch(text, intents(), {
    limit: options.limit || 5, minScore: options.minScore || 1,
    key: (record) => record.tool,
    keywords: (record) => [...(record.keywords_mk || []), ...(record.keywords_en || [])],
  });
  return hits.map((hit) => ({ tool: hit.record.tool, category: hit.record.category, score: hit.score, examples: [...(hit.record.keywords_mk || []).slice(0, 3), ...(hit.record.keywords_en || []).slice(0, 2)] }));
}
const KINDS = [
  { kind: 'memory', words: ['\u0437\u0430\u043f\u043e\u043c\u043d\u0438','\u043f\u043e\u0442\u0441\u0435\u0442\u0438','\u0437\u0430\u0431\u043e\u0440\u0430\u0432\u0438','remember','recall','forget','\u0448\u0442\u043e \u0437\u043d\u0430\u0435\u0448','what do you know'] },
  { kind: 'plan', words: ['\u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0438\u0440\u0430\u0458','\u043f\u043b\u0430\u043d','\u0440\u0430\u0441\u043f\u043e\u0440\u0435\u0434','\u0437\u0430\u0434\u0430\u0447\u0438','plan','schedule','roadmap'] },
  { kind: 'action', words: ['\u043d\u0430\u043f\u0440\u0430\u0432\u0438','\u043e\u0442\u0432\u043e\u0440\u0438','\u043e\u0431\u0458\u0430\u0432\u0438','\u043f\u0440\u0430\u0442\u0438','\u0441\u043d\u0438\u043c\u0438','\u043f\u0440\u0435\u0437\u0435\u043c\u0438','create','open','publish','send','download','\u0438\u0437\u0432\u0440\u0448\u0438','\u043f\u043e\u0441\u0442\u0430\u0432\u0438'] },
  { kind: 'data', words: ['\u0446\u0435\u043d\u0430','\u0432\u0440\u0435\u043c\u0435','\u0432\u0435\u0441\u0442','\u043a\u0443\u0440\u0441','\u043a\u043e\u043b\u043a\u0443','price','weather','news','rate','forecast'] },
  { kind: 'code', words: ['\u043a\u043e\u0434','\u0444\u0443\u043d\u043a\u0446\u0438\u0458\u0430','\u0441\u043a\u0440\u0438\u043f\u0442\u0430','\u0431\u0430\u0433','\u0434\u0435\u0431\u0430\u0433','code','function','script','bug','debug'] },
  { kind: 'knowledge', words: ['\u0448\u0442\u043e \u0435','\u043a\u043e\u0458 \u0435','\u043e\u0431\u0458\u0430\u0441\u043d\u0438','\u0437\u043e\u0448\u0442\u043e','what is','who is','explain','why'] },
];
function classify(text) {
  const haystack = String(text).toLowerCase();
  let best = { kind: 'general', score: 0 };
  for (const entry of KINDS) {
    let score = 0;
    for (const word of entry.words) if (haystack.includes(word)) score += word.includes(' ') ? 2 : 1;
    if (score > best.score) best = { kind: entry.kind, score };
  }
  return best;
}
function assumptionsFor(text, intentHits) {
  const assumptions = [];
  const haystack = String(text).toLowerCase();
  if (intentHits.some((hit) => /weather/.test(hit.tool)) && !/(\u0441\u043a\u043e\u043f\u0458\u0435|skopje|\u0431\u0435\u043b\u0433\u0440\u0430\u0434|sofia|\u0432\u043e [\u0430-\u0448]{3,})/i.test(haystack)) assumptions.push('\u041d\u0435\u043c\u0430 \u043d\u0430\u0432\u0435\u0434\u0435\u043d \u0433\u0440\u0430\u0434; \u043a\u043e\u0440\u0438\u0441\u0442\u0430\u043c \u0421\u043a\u043e\u043f\u0458\u0435 \u043a\u0430\u043a\u043e \u0441\u0442\u0430\u043d\u0434\u0430\u0440\u0434.');
  if (intentHits.some((hit) => /coin_|crypto/.test(hit.tool)) && !/(btc|eth|sol|ada|doge|bitcoin|ethereum)/i.test(haystack)) assumptions.push('\u041d\u0435\u043c\u0430 \u043d\u0430\u0432\u0435\u0434\u0435\u043d \u043a\u043e\u0438\u043d; \u043a\u043e\u0440\u0438\u0441\u0442\u0430\u043c BTC.');
  if (!intentHits.length) assumptions.push('\u041d\u0435\u043c\u0430 \u0441\u043e\u0432\u043f\u0430\u0453\u0430\u045a\u0435 \u0441\u043e \u0430\u043b\u0430\u0442\u043a\u0430; \u043e\u0434\u0433\u043e\u0432\u0430\u0440\u0430\u043c \u043e\u0434 \u043b\u043e\u043a\u0430\u043b\u043d\u043e \u0437\u043d\u0430\u0435\u045a\u0435 \u0438 \u043c\u0435\u043c\u043e\u0440\u0438\u0458\u0430.');
  return assumptions;
}
function safeRecall(text, options) {
  try { return require('../memory/store').recall(text, { limit: options.limit || 5 }); }
  catch { return { hits: [], total_facts: 0 }; }
}
function analyzeLocal(problem, options = {}) {
  const classified = classify(problem);
  const intentHits = routeIntent(problem, { limit: 4 });
  const memory = options.memory || { hits: [] };
  const known = memory.hits && memory.hits.length;
  const top = intentHits[0];
  const conclusion = top
    ? `\u0417\u0430 "${truncate(problem, 70)}" \u043d\u0430\u0458\u0441\u043e\u043e\u0434\u0432\u0435\u0442\u043d\u043e \u0435 \u0434\u0430 \u0458\u0430 \u0438\u0441\u043a\u043e\u0440\u0438\u0441\u0442\u0430\u043c \u0430\u043b\u0430\u0442\u043a\u0430\u0442\u0430 ${top.tool} (\u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0458\u0430 ${top.category}).`
    : `\u0417\u0430 "${truncate(problem, 70)}" \u043d\u0435\u043c\u0430 \u0434\u0438\u0440\u0435\u043a\u0442\u043d\u0430 \u0430\u043b\u0430\u0442\u043a\u0430; \u043e\u0434\u0433\u043e\u0432\u0430\u0440\u0430\u043c \u0441\u043e \u043b\u043e\u043a\u0430\u043b\u043d\u043e \u0440\u0430\u0441\u0443\u0434\u0443\u0432\u0430\u045a\u0435${known ? ' \u0438 \u043e\u043d\u0430 \u0448\u0442\u043e \u0433\u043e \u043f\u0430\u043c\u0442\u0430\u043c' : ''}.`;
  return {
    kind: classified.kind, conclusion, assumptions: assumptionsFor(problem, intentHits),
    options: intentHits.map((hit) => ({ tool: hit.tool, category: hit.category, score: hit.score })),
    next_actions: intentHits.slice(0, 3).map((hit, index) => `${index + 1}. ${hit.tool} (${hit.category})`),
    keywords: keywords(problem, 8).map((item) => item.token),
    sources: (memory.hits || []).slice(0, 3).map((hit) => ({ id: hit.id, text: truncate(hit.text, 90), learned_at: hit.learned_at })),
  };
}
function modelEndpoint(endpoint) {
  const raw = String(endpoint || '').trim().replace(/\/$/, '');
  if (!raw) return '';
  if (/\/chat\/completions$/i.test(raw)) return raw;
  return raw.endsWith('/v1') ? raw + '/chat/completions' : raw + '/v1/chat/completions';
}
async function callLocalModel(endpoint, options = {}, payload) {
  const system = options.system || '\u0422\u0438 \u0441\u0438 HUGO. \u041e\u0434\u0433\u043e\u0432\u0430\u0440\u0430\u0458 \u043a\u0440\u0430\u0442\u043a\u043e, \u0442\u043e\u0447\u043d\u043e \u0438 \u043d\u0430 \u043c\u0430\u043a\u0435\u0434\u043e\u043d\u0441\u043a\u0438. \u0410\u043a\u043e \u043d\u0435 \u0437\u043d\u0430\u0435\u0448, \u043a\u0430\u0436\u0438 \u0434\u0435\u043a\u0430 \u043d\u0435 \u0437\u043d\u0430\u0435\u0448.';
  const response = await fetch(modelEndpoint(endpoint), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    body: JSON.stringify({
      model: options.model || process.env[config.cognition.reasoning.model_env] || config.cognition.reasoning.model || 'local-model',
      temperature: config.cognition.reasoning.temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify({ task: payload.problem, memory: payload.memory, context: payload.context, route: payload.analysis }) },
      ],
    }),
    signal: AbortSignal.timeout(options.timeout_ms || 30000),
  });
  if (!response.ok) throw new Error(`local model HTTP ${response.status}`);
  const data = await response.json();
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}
async function reason(problem, context = {}, options = {}) {
  if (!problem || typeof problem !== 'string' || !problem.trim()) throw new Error('reason needs a problem statement');
  const memory = options.memory === false ? { hits: [] } : (context.memory || safeRecall(problem, options));
  const analysis = analyzeLocal(problem, { memory });
  const endpoint = options.endpoint || process.env[config.cognition.reasoning.endpoint_env];
  if (!endpoint) return { provider: 'local-rules', ...analysis, memory_used: (memory.hits || []).length };
  try {
    const content = await callLocalModel(endpoint, options, { problem, memory, context, analysis });
    return { provider: 'local-model', endpoint, content: truncate(content, 6000), ...analysis, memory_used: (memory.hits || []).length };
  } catch (error) {
    return { provider: 'local-rules', degraded: `\u043b\u043e\u043a\u0430\u043b\u043d\u0438\u043e\u0442 \u043c\u043e\u0434\u0435\u043b \u043d\u0435 \u0435 \u0434\u043e\u0441\u0442\u0430\u043f\u0435\u043d: ${error.message}`, ...analysis, memory_used: (memory.hits || []).length };
  }
}
function synthesize(task, parts, options = {}) {
  const lines = parts.filter(Boolean).map((part) => `- ${part}`);
  return truncate(`\u0417\u0430 "${truncate(task, 80)}":\n${lines.join('\n')}`, options.max || 2000);
}
module.exports = { reason, analyzeLocal, classify, routeIntent, synthesize, callLocalModel, intents, assumptionsFor };
