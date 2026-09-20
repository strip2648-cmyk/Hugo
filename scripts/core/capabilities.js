'use strict';
const fs = require('node:fs');
const path = require('node:path');
const config = require('../lib/config').load();
const { readJsonSync } = require('../lib/fsx');
function optional(path) { try { return require(path); } catch { return null; } }
function report() {
  const out = { version: config.version, at: new Date().toISOString(), policy: config.policy, items: [] };
  const add = (name, available, detail) => out.items.push({ name, available, detail });

  const store = optional('../memory/store');
  const memory = store ? store.stats() : null;
  add('memory', Boolean(memory), memory ? `${memory.facts} \u0444\u0430\u043a\u0442\u0438, ${memory.graph.entities} \u0435\u043d\u0442\u0438\u0442\u0435\u0442\u0438, ${memory.embeddings.vectors} \u0432\u0435\u043a\u0442\u043e\u0440\u0438` : '\u043c\u0435\u043c\u043e\u0440\u0438\u0458\u0430\u0442\u0430 \u043d\u0435 \u0435 \u0434\u043e\u0441\u0442\u0430\u043f\u043d\u0430');

  const ollamaEndpoint = process.env.OLLAMA_ENDPOINT || process.env.OLLAMA_HOST;
  const ollamaModel = process.env.OLLAMA_MODEL;
  const endpoint = process.env[config.cognition.reasoning.endpoint_env];
  const model = process.env[config.cognition.reasoning.model_env] || config.cognition.reasoning.model || 'local-model';
  add('reasoning', true, ollamaModel || ollamaEndpoint ? `Ollama: ${ollamaModel || 'llama3.2'} @ ${ollamaEndpoint || 'http://127.0.0.1:11434'}` : endpoint ? `локален AI: ${model} @ ${endpoint}` : `локални правила; AI модел: ${model}`);

  const chrome = optional('../eyes/chrome');
  let chromeState = { reachable: false };
  if (chrome) { try { chromeState = chrome.detect(); } catch { chromeState = { reachable: false }; } }
  add('eyes', Boolean(chromeState.reachable), chromeState.reachable ? `\u0442\u0432\u043e\u0458\u043e\u0442 Chrome \u0435 \u043f\u043e\u0432\u0440\u0437\u0430\u043d (\u043f\u043e\u0440\u0442\u0430 ${config.browser.port})` : `Chrome \u043d\u0435 \u0435 \u043f\u043e\u0432\u0440\u0437\u0430\u043d; \u0441\u0442\u0430\u0440\u0442\u0443\u0432\u0430\u0458 \u0433\u043e \u0441\u043e: npm run chrome`);

  add('voice', true, `\u043f\u0440\u0435\u043a\u0443 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u043e\u0442 (\u0431\u0435\u0437 \u043a\u043b\u0443\u0447); \u0458\u0430\u0437\u0438\u0446\u0438: ${config.voice.languages.join(', ')}`);

  const tools = optional('../tools/registry');
  if (tools) {
    const audit = tools.audit();
    add('tools', true, `${audit.counts.real} \u0440\u0435\u0430\u043b\u043d\u0438, ${audit.counts.browser} \u043f\u0440\u0435\u043a\u0443 \u0431\u0440\u0430\u0443\u0437\u0435\u0440, ${audit.counts.planned} \u043f\u043b\u0430\u043d\u0438\u0440\u0430\u043d\u0438`);
    out.tools = audit.counts;
  } else {
    add('tools', false, '\u0440\u0435\u0433\u0438\u0441\u0442\u0430\u0440\u043e\u0442 \u043d\u0430 \u0430\u043b\u0430\u0442\u043a\u0438 \u043d\u0435 \u0435 \u0434\u043e\u0441\u0442\u0430\u043f\u0435\u043d');
    out.tools = { real: 0, browser: 0, planned: 0 };
  }

  const agents = optional('../agents/registry');
  add('agents', Boolean(agents), agents ? `${agents.stats().total} \u0430\u0433\u0435\u043d\u0442\u0438 \u0432\u043e ${agents.stats().categories} \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438` : '\u043d\u0435\u0434\u043e\u0441\u0442\u0430\u043f\u043d\u0438');

  const campaigns = optional('../business/campaigns');
  const crm = optional('../business/crm');
  add('business', Boolean(campaigns && crm), campaigns && crm ? `\u043a\u0430\u043c\u043f\u0430\u045a\u0438: ${campaigns.list().length}, \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0438: ${crm.listContacts().length}` : '\u0431\u0438\u0437\u043d\u0438\u0441 \u043c\u043e\u0434\u0443\u043b\u0438\u0442\u0435 \u043d\u0435 \u0441\u0435 \u0434\u043e\u0441\u0442\u0430\u043f\u043d\u0438');

  const scheduler = optional('../automation/scheduler');
  add('automation', Boolean(scheduler), scheduler ? `${scheduler.list().length} \u0437\u0430\u043a\u0430\u0436\u0430\u043d\u0438 \u0437\u0430\u0434\u0430\u0447\u0438` : '\u043d\u0435\u0434\u043e\u0441\u0442\u0430\u043f\u043d\u0430');

  const integrations = optional('../integrations/registry');
  add('integrations', Boolean(integrations), integrations ? `${integrations.list().length} \u0430\u0434\u0430\u043f\u0442\u0435\u0440\u0438 (\u0441\u0438\u0442\u0435 \u0431\u0435\u0437 \u043a\u043b\u0443\u0447)` : '\u043d\u0435\u0434\u043e\u0441\u0442\u0430\u043f\u043d\u0438');

  add('git', fs.existsSync(path.join(config.root, '.git')), fs.existsSync(path.join(config.root, '.git')) ? `\u0440\u0435\u043f\u043e: ${config.repo.url}` : '\u043d\u0435\u043c\u0430 git \u0440\u0435\u043f\u043e \u0432\u043e \u043e\u0432\u0430\u0430 \u043f\u0430\u043f\u043a\u0430');
  add('keyless', true, config.policy.keys_required ? '\u0431\u0430\u0440\u0430 \u043a\u043b\u0443\u0447\u0435\u0432\u0438' : '\u043d\u0435 \u0431\u0430\u0440\u0430 \u043d\u0438\u0442\u0443 \u0435\u0434\u0435\u043d \u043a\u043b\u0443\u0447');

  const actionsModule = optional('./actions');
  if (actionsModule) {
    const list = actionsModule.list();
    const categories = Object.entries(actionsModule.byCategory()).map(([category, names]) => ({ category, count: names.length }));
    out.actions = { total: list.length, categories: categories.sort((a, b) => b.count - a.count) };
  } else {
    out.actions = { total: 0, categories: [] };
  }
  return out;
}
module.exports = { report };
