'use strict';

const config = require('../lib/config').load();
const { readJsonSync, writeJsonSync } = require('../lib/fsx');
const registry = require('./registry');
const KEYWORDS = {
  file_write: { mk: ['направи фајл', 'направи датотека', 'креирај фајл', 'запиши фајл', 'направи test.txt со hello'], en: ['create file', 'write file'] },
  file_read: { mk: ['прочитај фајл', 'покажи фајл'], en: ['read file'] },
  file_edit: { mk: ['замени во фајл', 'измени фајл'], en: ['edit file'] },
  file_append: { mk: ['додај во фајл'], en: ['append file'] },
  file_list: { mk: ['листај фајлови'], en: ['list files'] },
  file_search: { mk: ['пребарај фајлови', 'најди фајл'], en: ['search files'] },
  file_delete: { mk: ['избриши фајл'], en: ['delete file'] },
  file_copy: { mk: ['копирај фајл'], en: ['copy file'] },
  file_move: { mk: ['премести фајл'], en: ['move file'] },
  file_tree: { mk: ['дрво на папка'], en: ['folder tree'] },
  host_report: { mk: ['што има на компјутерот', 'детектирај систем'], en: ['host report'] },
  ps_run: { mk: ['powershell'], en: ['powershell'] },
  wsl_run: { mk: ['wsl команда'], en: ['wsl command'] },
  wsl_list: { mk: ['wsl дистрибуции'], en: ['wsl distros'] },
  process_list: { mk: ['процеси'], en: ['processes'] },
  process_kill: { mk: ['затвори процес'], en: ['kill process'] },
  app_open: { mk: ['отвори апликација', 'отвори папка'], en: ['open app'] },
  app_start: { mk: ['отвори notepad'], en: ['start notepad'] },
  clip_get: { mk: ['clipboard'], en: ['clipboard'] },
  clip_set: { mk: ['стави во clipboard'], en: ['set clipboard'] },
  screen_shot: { mk: ['слика од екран'], en: ['screenshot'] },
  say: { mk: ['кажи', 'изговори'], en: ['say'] },
  notify: { mk: ['нотификација'], en: ['notify'] },
  fb_open: { mk: ['отвори facebook', 'фејсбук'], en: ['open facebook'] },
  fb_write_post: { mk: ['напиши пост'], en: ['write post'] },
  fb_publish: { mk: ['објави', 'објави пост'], en: ['publish post'] },
  fb_feed_read: { mk: ['што има ново'], en: ['facebook feed'] },
  fb_search: { mk: ['пребарај на facebook'], en: ['search facebook'] },
  yt_open: { mk: ['отвори youtube'], en: ['open youtube'] },
  yt_search: { mk: ['пребарај на youtube'], en: ['search youtube'] },
  yt_play: { mk: ['пушти', 'пушти на youtube', 'отвори youtube и пушти'], en: ['play'] },
  yt_pause: { mk: ['паузирај'], en: ['pause'] },
  yt_next: { mk: ['следно видео'], en: ['next video'] },
  yt_volume: { mk: ['тон на youtube'], en: ['youtube volume'] },
  yt_now_playing: { mk: ['што свири'], en: ['now playing'] },
};
function implemented() { return [...registry.all().values()].filter((entry) => typeof entry.run === 'function'); }
function sync() {
  const catalog = readJsonSync(config.file.toolsCatalog, { version: config.version, tools: {} });
  const tools = catalog.tools || {};
  let added = 0; let updated = 0;
  for (const entry of implemented()) {
    const previous = tools[entry.id];
    const keywords = KEYWORDS[entry.id] || { mk: [], en: [] };
    if (!previous) added += 1; else updated += 1;
    tools[entry.id] = {
      ...(previous || {}), name: entry.name || entry.id, category: entry.category || entry.module || previous?.category || 'other',
      status: 'real', implemented: true, description: entry.description || previous?.description || entry.id,
      params: entry.params || previous?.params || {},
      keywords_mk: keywords.mk.length ? keywords.mk : (previous?.keywords_mk || []),
      keywords_en: keywords.en.length ? keywords.en : (previous?.keywords_en || []),
    };
  }
  catalog.tools = tools; catalog.total = Object.keys(tools).length; catalog.version = config.version;
  writeJsonSync(config.file.toolsCatalog, catalog);
  const audit = registry.audit();
  const intents = readJsonSync(config.file.intents, { version: config.version, intents: [] });
  const existing = new Map((intents.intents || []).map((row) => [row.tool, row]));
  const rows = [...registry.all().values()].map((entry) => {
    const previous = existing.get(entry.id) || {};
    const keywords = KEYWORDS[entry.id] || { mk: [], en: [] };
    return {
      tool: entry.id, category: entry.category || entry.module || 'other', implemented: typeof entry.run === 'function',
      keywords_mk: keywords.mk.length ? keywords.mk : (previous.keywords_mk || []),
      keywords_en: keywords.en.length ? keywords.en : (previous.keywords_en || []),
      examples_mk: previous.examples_mk || [], examples_en: previous.examples_en || [],
    };
  });
  intents.intents = rows; intents.total = rows.length; intents.version = config.version; intents.generated = new Date().toISOString();
  writeJsonSync(config.file.intents, intents);
  return { ok: true, catalog_total: catalog.total, implemented: implemented().length, added, updated, audit: audit.counts, intents: rows.length };
}
function check() {
  const catalog = readJsonSync(config.file.toolsCatalog, { tools: {} }).tools || {};
  const intents = readJsonSync(config.file.intents, { intents: [] }).intents || [];
  const implIds = new Set(implemented().map((entry) => entry.id));
  const catalogIds = new Set(Object.keys(catalog));
  const problems = [];
  for (const id of catalogIds) if (catalog[id] && catalog[id].status === 'real' && !implIds.has(id)) problems.push({ type: 'catalog_claims_real_but_missing', tool: id });
  for (const id of implIds) if (!catalogIds.has(id)) problems.push({ type: 'implemented_but_not_in_catalog', tool: id });
  for (const row of intents) if (!catalogIds.has(row.tool)) problems.push({ type: 'intent_points_to_unknown_tool', tool: row.tool });
  const actions = require('../core/actions');
  for (const name of (config.confirm.require || [])) if (!implIds.has(name) && !actions.find(name)) problems.push({ type: 'confirm_rule_without_action', tool: name });
  return { ok: problems.length === 0, problems, catalog: catalogIds.size, implemented: implIds.size, intents: intents.length, intents_not_implemented: intents.filter((row) => !implIds.has(row.tool)).length };
}
module.exports = { sync, check, KEYWORDS, implemented };
