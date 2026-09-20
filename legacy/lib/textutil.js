'use strict';
const STOPWORDS = new Set(['the','a','an','and','or','but','if','then','than','that','this','these','those','is','are','was','were','be','been','to','of','in','on','for','with','as','at','by','from','it','its','i','you','he','she','they','we','my','your','our','their','me','him','her','them','us','do','does','did','so','not','no','yes','can','could','should','would','will','just','about','into','over','after']);
const MK = ['\u0438','\u0438\u043b\u0438','\u043d\u043e','\u0430\u043a\u043e','\u0442\u043e\u0433\u0430\u0448','\u0448\u0442\u043e','\u043e\u0432\u0430','\u043e\u043d\u0430','\u0442\u0438\u0435','\u043e\u0432\u0438\u0435','\u0435','\u0441\u0435','\u0431\u0435\u0448\u0435','\u0431\u0438\u0434\u0435','\u0434\u0430','\u043d\u0430','\u0432\u043e','\u0437\u0430','\u0441\u043e','\u043e\u0434','\u0434\u043e','\u043f\u043e','\u043a\u0430\u0458','\u043d\u0438\u0437','\u0442\u043e\u0430','\u0458\u0430\u0441','\u0442\u0438','\u0442\u043e\u0458','\u0442\u0430\u0430','\u043d\u0438\u0435','\u0432\u0438\u0435','\u043c\u0438','\u043c\u0435','\u0433\u043e','\u0458\u0430','\u0433\u0438','\u043d\u0435','\u043d\u0438','\u043b\u0438','\u043f\u0430\u043a','\u0443\u0448\u0442\u0435','\u0441\u0430\u043c\u043e','\u043a\u0430\u043a\u043e','\u043a\u043e\u0433\u0430','\u043a\u0430\u0434\u0435','\u0437\u043e\u0448\u0442\u043e','\u0434\u0430\u043b\u0438'];
for (const word of MK) STOPWORDS.add(word);
const DIACRITICS = { '\u045C': '\u043A', '\u0453': '\u0433', '\u045F': '\u0446', '\u0459': '\u043B', '\u045A': '\u043D', '\u0458': 'j', '\u0455': '\u0437', '\u0450': '\u0435', '\u045D': '\u0438' };
function fold(input) {
  let text = String(input == null ? '' : input).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  for (const [from, to] of Object.entries(DIACRITICS)) text = text.split(from).join(to);
  return text;
}
function tokens(input) { return fold(input).split(/[^0-9a-z\u0430-\u044F\u0400-\u04FF]+/i).filter((token) => token.length > 1 && !STOPWORDS.has(token)); }
function keywords(input, limit = 12) {
  const counts = new Map();
  for (const token of tokens(input)) counts.set(token, (counts.get(token) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([token, count]) => ({ token, count }));
}
function ngrams(list, size = 2) { const out = []; for (let index = 0; index + size <= list.length; index += 1) out.push(list.slice(index, index + size).join('_')); return out; }
function sentences(input) { return String(input == null ? '' : input).split(/(?<=[.!?\u2026])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 1); }
function jaccard(leftTokens, rightTokens) {
  const a = new Set(leftTokens || []); const b = new Set(rightTokens || []);
  if (!a.size && !b.size) return 1;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}
function truncate(input, max = 160) {
  const text = String(input == null ? '' : input).replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}\u2026`;
}
function slugify(input, max = 60) { return fold(input).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max) || 'item'; }
function stripHtml(html) {
  return String(html == null ? '' : html).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}
function extractTitle(html) { const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i); return match ? stripHtml(match[1]) : ''; }
function extractLinks(html, base = '') {
  const out = [];
  for (const match of String(html || '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1].trim();
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) continue;
    let absolute = href;
    try { absolute = new URL(href, base || undefined).toString(); } catch { /* keep raw */ }
    out.push({ href: absolute, text: stripHtml(match[2]).slice(0, 120) });
  }
  return out.slice(0, 200);
}
function extractForms(html) {
  const forms = [];
  for (const match of String(html || '').matchAll(/<form[\s\S]*?<\/form>/gi)) {
    const block = match[0];
    const inputs = [];
    for (const field of block.matchAll(/<(input|textarea|select)[^>]*>/gi)) {
      const tag = field[0];
      const name = (tag.match(/name=["']([^"']+)["']/i) || [])[1] || null;
      const type = (tag.match(/type=["']([^"']+)["']/i) || [])[1] || (field[1].toLowerCase() === 'textarea' ? 'textarea' : 'text');
      if (name) inputs.push({ name, type });
    }
    const action = (block.match(/action=["']([^"']*)["']/i) || [])[1] || '';
    const method = ((block.match(/method=["']([^"']+)["']/i) || [])[1] || 'get').toLowerCase();
    if (inputs.length) forms.push({ action, method, fields: inputs });
  }
  return forms.slice(0, 20);
}
function syllableCount(word) { const clean = fold(word).replace(/[^a-z]/g, ''); if (!clean) return 0; const groups = clean.replace(/e$/, '').match(/[aeiouy]+/g); return Math.max(1, groups ? groups.length : 1); }
function fleschReadingEase(text) {
  const words = String(text == null ? '' : text).split(/\s+/).filter(Boolean);
  const sentenceList = sentences(text);
  if (!words.length || !sentenceList.length) return 0;
  const syllables = words.reduce((total, word) => total + syllableCount(word), 0);
  return Number((206.835 - 1.015 * (words.length / sentenceList.length) - 84.6 * (syllables / words.length)).toFixed(2));
}
function unique(list) { return [...new Set(list)]; }
module.exports = { STOPWORDS, fold, tokens, keywords, ngrams, sentences, jaccard, truncate, slugify, stripHtml, extractTitle, extractLinks, extractForms, syllableCount, fleschReadingEase, unique };
