'use strict';
const { InputError } = require('../../lib/errors');
const { sentences, tokens, keywords, fleschReadingEase, truncate } = require('../../lib/textutil');
const { request } = require('../../lib/http');
const POSITIVE = new Set(['\u0434\u043e\u0431\u0440\u043e','\u043e\u0434\u043b\u0438\u0447\u043d\u043e','\u0443\u0441\u043f\u0435\u0445','\u0441\u0443\u043f\u0435\u0440','\u0440\u0430\u0434\u043e\u0441\u0442','\u043b\u0443\u0431\u043e\u0432','\u043f\u043e\u0431\u0435\u0434\u0430','good','great','excellent','love','happy','win','success','amazing','perfect','best']);
const NEGATIVE = new Set(['\u043b\u043e\u0448\u043e','\u0443\u0436\u0430\u0441','\u0433\u0440\u0435\u0448\u043a\u0430','\u043f\u0440\u043e\u0431\u043b\u0435\u043c','\u0441\u043b\u0430\u0431\u043e','\u043f\u0430\u0434','\u0433\u0443\u0431\u0438\u0442\u043a\u0430','bad','terrible','hate','sad','loss','fail','error','worst','broken']);
function summarize(text, maxSentences = 3) {
  const list = sentences(text);
  if (list.length <= maxSentences) return { summary: list.join(' '), method: 'extractive(full)' };
  const frequency = new Map();
  for (const token of tokens(text)) frequency.set(token, (frequency.get(token) || 0) + 1);
  const scored = list.map((sentence, index) => ({
    sentence, index,
    score: (tokens(sentence).reduce((total, token) => total + (frequency.get(token) || 0), 0) / Math.max(1, tokens(sentence).length)) * (index === 0 ? 1.4 : 1),
  })).sort((a, b) => b.score - a.score).slice(0, maxSentences).sort((a, b) => a.index - b.index);
  return { summary: scored.map((item) => item.sentence).join(' '), method: 'extractive(tf+position)' };
}
const tools = {
  summarize: { category: 'text', description: '\u0421\u0443\u043c\u0438\u0440\u0430\u0458 \u0442\u0435\u043a\u0441\u0442 (\u043b\u043e\u043a\u0430\u043b\u043d\u043e)', params: { text: 'string', max_sentences: 'number' }, run: async (args) => {
    const text = String(args.text || args.query || '');
    if (text.length < 40) throw new InputError('text is required (at least 40 characters)');
    const result = summarize(text, Math.min(Number(args.max_sentences) || 3, 10));
    return { ...result, words: text.split(/\s+/).filter(Boolean).length, keywords: keywords(text, 8).map((item) => item.token) };
  } },
  word_count: { category: 'text', description: '\u0411\u0440\u043e\u0458 \u0437\u0431\u043e\u0440\u043e\u0432\u0438 \u0438 \u0437\u043d\u0430\u0446\u0438', params: { text: 'string' }, run: async (args) => {
    const text = String(args.text || '');
    const words = text.split(/\s+/).filter(Boolean);
    return { words: words.length, characters: text.length, characters_no_spaces: text.replace(/\s/g, '').length, sentences: sentences(text).length, unique_words: new Set(words.map((word) => word.toLowerCase())).size };
  } },
  reading_time: { category: 'text', description: '\u0412\u0440\u0435\u043c\u0435 \u0437\u0430 \u0447\u0438\u0442\u0430\u045a\u0435', params: { text: 'string' }, run: async (args) => {
    const words = String(args.text || '').split(/\s+/).filter(Boolean).length;
    return { words, minutes: Number((words / 200).toFixed(2)), spoken_minutes: Number((words / 130).toFixed(2)) };
  } },
  readability: { category: 'text', description: '\u0427\u0438\u0442\u043b\u0438\u0432\u043e\u0441\u0442 (Flesch)', params: { text: 'string' }, run: async (args) => {
    const text = String(args.text || '');
    const score = fleschReadingEase(text);
    return { flesch_reading_ease: score, label: score >= 80 ? '\u043c\u043d\u043e\u0433\u0443 \u043b\u0435\u0441\u043d\u043e' : score >= 60 ? '\u043b\u0435\u0441\u043d\u043e' : score >= 40 ? '\u0441\u0440\u0435\u0434\u043d\u043e' : '\u0442\u0435\u0448\u043a\u043e', sentences: sentences(text).length };
  } },
  sentiment: { category: 'text', description: '\u0421\u0435\u043d\u0442\u0438\u043c\u0435\u043d\u0442 (\u043b\u043e\u043a\u0430\u043b\u0435\u043d \u043b\u0435\u043a\u0441\u0438\u043a\u043e\u043d)', params: { text: 'string' }, run: async (args) => {
    const list = tokens(String(args.text || ''));
    let positive = 0; let negative = 0;
    for (const token of list) { if (POSITIVE.has(token)) positive += 1; if (NEGATIVE.has(token)) negative += 1; }
    const total = positive + negative;
    const score = total ? Number(((positive - negative) / total).toFixed(3)) : 0;
    return { score, label: score > 0.2 ? '\u043f\u043e\u0437\u0438\u0442\u0438\u0432\u0435\u043d' : score < -0.2 ? '\u043d\u0435\u0433\u0430\u0442\u0438\u0432\u0435\u043d' : '\u043d\u0435\u0443\u0442\u0440\u0430\u043b\u0435\u043d', positive, negative, note: '\u041b\u043e\u043a\u0430\u043b\u0435\u043d \u043b\u0435\u043a\u0441\u0438\u043a\u043e\u043d, \u043d\u0435 \u043d\u0435\u0432\u0440\u043e\u043d\u0441\u043a\u0438 \u043c\u043e\u0434\u0435\u043b' };
  } },
  keyword_extract: { category: 'text', description: '\u041a\u043b\u0443\u0447\u043d\u0438 \u0437\u0431\u043e\u0440\u043e\u0432\u0438', params: { text: 'string', limit: 'number' }, run: async (args) => ({ keywords: keywords(String(args.text || ''), Math.min(Number(args.limit) || 12, 40)) }) },
  named_entities: { category: 'text', description: '\u0418\u043c\u0438\u045a\u0430, \u0434\u043e\u043c\u0435\u043d\u0438, \u043c\u0435\u0438\u043b\u043e\u0432\u0438', params: { text: 'string' }, run: async (args) => {
    const text = String(args.text || '');
    const unique = (list) => [...new Set(list)].slice(0, 20);
    return {
      people: unique([...text.matchAll(/\b(\p{Lu}[\p{L}]{2,}\s+\p{Lu}[\p{L}]{2,})\b/gu)].map((match) => match[1])),
      domains: unique([...text.matchAll(/\b([a-z0-9-]+\.(?:com|net|org|mk|io|ai|dev|app))\b/gi)].map((match) => match[1])),
      handles: unique([...text.matchAll(/@([a-zA-Z0-9_.]{3,})/g)].map((match) => '@' + match[1])),
      emails: unique([...text.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)].map((match) => match[0])),
    };
  } },
  bullets: { category: 'text', description: '\u041f\u0440\u0435\u0442\u0432\u043e\u0440\u0438 \u0432\u043e \u0431\u0443\u043b\u0435\u0442\u0438', params: { text: 'string' }, run: async (args) => {
    const list = sentences(String(args.text || ''));
    return { bullets: list.slice(0, 20).map((sentence) => '- ' + truncate(sentence, 160)), count: list.length };
  } },
  spell_check: { category: 'text', description: '\u041f\u0440\u0430\u0432\u043e\u043f\u0438\u0441 (\u0431\u0435\u0437 \u043a\u043b\u0443\u0447)', params: { text: 'string', language: 'en-US|mk' }, run: async (args) => {
    const text = String(args.text || '');
    if (text.length > 2000) return { note: '\u041c\u0430\u043a\u0441 2000 \u0437\u043d\u0430\u0446\u0438 \u0437\u0430 \u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u0430\u0442\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430', characters: text.length };
    const body = new URLSearchParams({ text, language: String(args.language || 'en-US') }).toString();
    const response = await request('https://api.languagetool.org/v2/check', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, timeout_ms: 20000 });
    const data = JSON.parse(response.text);
    return { issues: (data.matches || []).slice(0, 25).map((match) => ({ message: match.message, suggestions: (match.replacements || []).slice(0, 3).map((item) => item.value) })), total_issues: (data.matches || []).length, source: 'languagetool' };
  } },
  translate: { category: 'text', status: 'browser', description: '\u041f\u0440\u0435\u0432\u0435\u0434\u0438 \u043f\u0440\u0435\u043a\u0443 \u0442\u0432\u043e\u0458\u043e\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 (\u0431\u0435\u0437 \u043a\u043b\u0443\u0447)', params: { text: 'string', to: 'mk|en|sr|bg' }, run: async (args) => {
    const text = String(args.text || args.query || '').trim();
    if (!text) throw new InputError('text is required');
    const to = String(args.to || 'en').toLowerCase();
    const eyes = require('../../eyes/actions');
    const url = `https://translate.google.com/?sl=auto&tl=${encodeURIComponent(to)}&text=${encodeURIComponent(text)}&op=translate`;
    const page = await eyes.run('browser_read', { url, wait_ms: 2500, limit: 8000 });
    return { to, via: 'browser', text: truncate(page.text || '', 1500), url, note: '\u041f\u0440\u0435\u0432\u043e\u0434\u043e\u0442 \u0433\u043e \u0432\u0440\u0448\u0438 \u0442\u0432\u043e\u0458\u043e\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440, \u043d\u0435 \u043d\u0430\u0434\u0432\u043e\u0440\u0435\u0448\u0435\u043d \u0441\u0435\u0440\u0432\u0438\u0441' };
  } },
  detect_language: { category: 'text', description: '\u0414\u0435\u0442\u0435\u043a\u0442\u0438\u0440\u0430\u0458 \u0458\u0430\u0437\u0438\u043a', params: { text: 'string' }, run: async (args) => {
    const text = String(args.text || '');
    const cyrillic = (text.match(/[\u0400-\u04ff]/g) || []).length;
    const latin = (text.match(/[a-zA-Z]/g) || []).length;
    const mkSpecific = (text.match(/[\u045C\u0453\u045F\u0459\u045A\u0455]/g) || []).length;
    if (cyrillic > latin) return { language: mkSpecific > 0 ? 'mk' : 'cyrillic', confidence: 0.8 };
    if (latin > cyrillic) return { language: 'latin', confidence: 0.6 };
    return { language: 'unknown', confidence: 0 };
  } },
};
module.exports = { tools, summarize };
