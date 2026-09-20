'use strict';
const { getJson, getText } = require('../../lib/http');
const { stripHtml, truncate, sentences } = require('../../lib/textutil');
const { InputError } = require('../../lib/errors');
const config = require('../../lib/config').load();
const tools = {
  learn_from_url: { category: 'knowledge', description: '\u041d\u0430\u0443\u0447\u0438 \u043e\u0434 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u0438 \u0437\u0430\u043f\u0430\u043c\u0442\u0438', params: { url: 'string', limit: 'number' }, run: async (args) => {
    const url = String(args.url || args.query || '');
    if (!url) throw new InputError('url is required');
    const response = await getText(url, { timeout_ms: 20000 });
    const text = stripHtml(response.text);
    const store = require('../../memory/store');
    const facts = [];
    for (const sentence of sentences(text).slice(0, Number(args.limit) || 8)) {
      if (sentence.length < 60) continue;
      const result = await store.learn(`${truncate(sentence, 300)} (извор: ${url})`, { source: url, tags: ['web', 'learned'], confidence: 0.6 });
      facts.push({ id: result.fact.id, updated: result.updated });
    }
    return { url, words: text.split(/\s+/).filter(Boolean).length, facts_learned: facts.length, facts };
  } },
  learn_from_repo: { category: 'knowledge', description: '\u041d\u0430\u0443\u0447\u0438 \u043e\u0434 GitHub \u0440\u0435\u043f\u043e\u0437\u0438\u0442\u043e\u0440\u0438\u0443\u043c', params: { repo: 'owner/name', limit: 'number' }, run: async (args) => {
    const repo = String(args.repo || args.query || '').trim().replace(/^https?:\/\/github\.com\//, '');
    if (!repo.includes('/')) throw new InputError('repo must look like owner/name');
    const info = await getJson(`https://api.github.com/repos/${repo}`, { timeout_ms: 15000 });
    let readme = '';
    for (const branch of [info.default_branch, 'main', 'master']) {
      if (!branch) continue;
      try { const response = await getText(`https://raw.githubusercontent.com/${repo}/${branch}/README.md`, { accept: 'text/plain', timeout_ms: 15000 }); if (response.text) { readme = response.text; break; } }
      catch { /* try next branch */ }
    }
    if (!readme) throw new Error(`no README found for ${repo}`);
    const store = require('../../memory/store');
    const graph = require('../../memory/graph');
    const items = [];
    for (const line of readme.split('\n')) {
      if (items.length >= (Number(args.limit) || config.learning.max_items_per_repo)) break;
      const match = line.match(/^\s*[-*]\s+\[([^\]]{3,80})\]\(([^)]+)\)\s*[-\u2013\u2014:]\s*(.{10,200})/);
      if (!match) continue;
      items.push({ name: match[1], url: match[2], description: match[3].trim() });
    }
    let learned = 0;
    for (const item of items) {
      const result = await store.learn(`${item.name} — ${item.description} (извор: ${repo} ${item.url})`, { source: `github:${repo}`, tags: ['github', 'skill'], confidence: 0.55 });
      if (!result.updated) learned += 1;
      graph.addEntity({ label: item.name, type: 'tool', source: result.fact.id });
    }
    graph.addEntity({ label: repo, type: 'source', source: `github:${repo}` });
    return { repo, stars: info.stargazers_count, description: truncate(info.description || '', 200), readme_chars: readme.length, items_found: items.length, facts_learned: learned, sample: items.slice(0, 5) };
  } },
  knowledge_search: { category: 'knowledge', description: '\u041f\u0440\u0435\u0431\u0430\u0440\u0430\u0458 \u0437\u043d\u0430\u0435\u045a\u0435 (\u043c\u0435\u043c\u043e\u0440\u0438\u0458\u0430 + \u0433\u0440\u0430\u0444)', params: { query: 'string' }, run: async (args) => {
    const query = String(args.query || args.text || '');
    if (!query) throw new InputError('query is required');
    const store = require('../../memory/store');
    const graph = require('../../memory/graph');
    const recall = store.recall(query, { limit: Number(args.limit) || 8 });
    return { query, hits: recall.hits, entities: graph.searchEntities(query, 8), note: '\u041b\u043e\u043a\u0430\u043b\u043d\u043e \u0437\u043d\u0430\u0435\u045a\u0435 \u043e\u0434 \u043c\u0435\u043c\u043e\u0440\u0438\u0458\u0430\u0442\u0430 \u0438 \u0433\u0440\u0430\u0444\u043e\u0442' };
  } },
  self_upgrade: { category: 'knowledge', description: '\u0410\u0436\u0443\u0440\u0438\u0440\u0430\u0458 \u0441\u0435 \u043e\u0434 Git (\u0431\u0435\u0437 \u043a\u043b\u0443\u0447)', params: { mode: 'pull|status' }, run: async (args) => {
    const { execFileSync } = require('node:child_process');
    const run = (args2) => execFileSync('git', args2, { cwd: config.root, encoding: 'utf8' }).trim();
    try {
      if (String(args.mode || 'pull') === 'status') return { branch: run(['rev-parse', '--abbrev-ref', 'HEAD']), head: run(['rev-parse', '--short', 'HEAD']), dirty: run(['status', '--porcelain']).split('\n').filter(Boolean).length };
      const before = run(['rev-parse', '--short', 'HEAD']);
      const output = run(['pull', '--ff-only', config.repo.remote, config.repo.branch]);
      return { before, after: run(['rev-parse', '--short', 'HEAD']), output, updated: !/Already up to date/i.test(output) };
    } catch (error) { return { error: error.message, note: '\u0410\u0436\u0443\u0440\u0438\u0440\u0430\u045a\u0435\u0442\u043e \u0431\u0430\u0440\u0430 git \u0440\u0435\u043f\u043e \u0438 \u043c\u0440\u0435\u0436\u0430' }; }
  } },
};
module.exports = { tools };
