'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { readJsonSync, readTextSync, ensureDir } = require('./fsx');
const ROOT = path.resolve(__dirname, '..', '..');
let cache = null;

function stripOuterQuotes(value) {
  const text = String(value || '').trim();
  if (text.length >= 2 && ((text[0] === '"' && text.at(-1) === '"') || (text[0] === "'" && text.at(-1) === "'"))) return text.slice(1, -1);
  return text;
}
function loadDotEnv(file = path.join(ROOT, '.env')) {
  if (!fs.existsSync(file)) return { loaded: false, file };
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let loaded = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const name = match[1];
    let value = match[2].trim();
    if (!value) value = '';
    if (!value.startsWith('\"') && !value.startsWith("'")) {
      const hash = value.indexOf(' #');
      if (hash >= 0) value = value.slice(0, hash).trim();
    }
    value = stripOuterQuotes(value);
    if (process.env[name] === undefined) { process.env[name] = value; loaded += 1; }
  }
  return { loaded: true, file, variables: loaded };
}
loadDotEnv();
function envStr(name, fallback) { const value = process.env[name]; return value === undefined || value === '' ? fallback : value; }
function envBool(name, fallback) { const value = process.env[name]; if (value === undefined || value === '') return fallback; return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase()); }
function envInt(name, fallback) { const value = process.env[name]; if (value === undefined || value === '') return fallback; const parsed = Number.parseInt(value, 10); return Number.isFinite(parsed) ? parsed : fallback; }
function isPlainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) return override === undefined ? base : override;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) out[key] = isPlainObject(value) && isPlainObject(base[key]) ? deepMerge(base[key], value) : value;
  return out;
}
function resolvePath(value, fallback) {
  if (typeof value === 'string' && value) return value;
  if (value && typeof value === 'object') return value.store || value.file || value.path || fallback;
  return fallback;
}
function applyEnv(config) {
  config.repo = config.repo || {};
  config.repo.url = envStr('HUGO_REPO', config.repo.url);
  config.repo.branch = envStr('HUGO_BRANCH', config.repo.branch);
  config.memory.retention_days = envInt('HUGO_RETENTION_DAYS', config.memory.retention_days);
  config.memory.auto_push = envBool('HUGO_MEMORY_AUTO_PUSH', true);
  config.memory.sync_interval_ms = envInt('HUGO_MEMORY_SYNC_INTERVAL_MS', 900000);
  config.browser.port = envInt('HUGO_CHROME_PORT', config.browser.port);
  config.browser.bin = envStr('HUGO_CHROME_BIN', config.browser.bin);
  config.browser.profile = envStr('HUGO_CHROME_PROFILE', config.browser.profile);
  config.browser.profile_mode = envStr('HUGO_CHROME_PROFILE_MODE', config.browser.profile_mode);
  config.voice.default_language = envStr('HUGO_VOICE_LANG', config.voice.default_language);
  config.vision = config.vision || {};
  config.vision.endpoint = envStr('HUGO_VISION_ENDPOINT', config.vision.endpoint || '');
  config.cognition.reasoning.endpoint_env = envStr('HUGO_LOCAL_AI_ENDPOINT_ENV', config.cognition.reasoning.endpoint_env || 'HUGO_LOCAL_AI_ENDPOINT');
  config.cognition.reasoning.model_env = envStr('HUGO_LOCAL_AI_MODEL_ENV', config.cognition.reasoning.model_env || 'HUGO_LOCAL_AI_MODEL');
  config.cognition.reasoning.model = envStr('HUGO_LOCAL_AI_MODEL', config.cognition.reasoning.model || 'local-model');
  config.ui.port = envInt('HUGO_UI_PORT', config.ui.port);
  config.gateway.port = envInt('HUGO_GATEWAY_PORT', config.gateway.port);
  config.logging.level = envStr('HUGO_LOG_LEVEL', config.logging.level);
  config.automation.timezone = envStr('HUGO_TZ', config.automation.timezone);
  config.files.base_dir = envStr('HUGO_FILES_BASE_DIR', config.files.base_dir);
  config.host.shell_timeout_ms = envInt('HUGO_HOST_SHELL_TIMEOUT_MS', config.host.shell_timeout_ms);
  config.host.allow_destructive_shell = envBool('HUGO_ALLOW_DESTRUCTIVE_SHELL', config.host.allow_destructive_shell);
  config.confirm.ttl_ms = envInt('HUGO_CONFIRM_TTL_MS', config.confirm.ttl_ms);
  config.jobs.max_attempts = envInt('HUGO_JOBS_MAX_ATTEMPTS', config.jobs.max_attempts);
  return config;
}
function applyDefaults(config) {
  config.files = config.files || {};
  const files = config.files;
  files.base_dir = files.base_dir || 'auto';
  files.allow_roots = Array.isArray(files.allow_roots) && files.allow_roots.length ? files.allow_roots : ['~', '/tmp', '$TMPDIR', '.'];
  files.deny = Array.isArray(files.deny) ? files.deny : [];
  files.max_read_bytes = files.max_read_bytes || 2000000;
  files.trash_dir = files.trash_dir || '.hugo/trash';
  config.host = config.host || {};
  config.host.shell_timeout_ms = config.host.shell_timeout_ms || 60000;
  config.host.allow_destructive_shell = config.host.allow_destructive_shell === true;
  config.sites = config.sites || {};
  config.sites.facebook = { auto_confirm_publish: false, post_delay_ms: 4000, ...(config.sites.facebook || {}) };
  config.sites.youtube = { search_delay_ms: 3000, default_volume: 0.7, ...(config.sites.youtube || {}) };
  config.confirm = config.confirm || {};
  config.confirm.ttl_ms = config.confirm.ttl_ms || 600000;
  config.confirm.require = Array.isArray(config.confirm.require) && config.confirm.require.length ? config.confirm.require : ['fb_publish', 'file_delete', 'process_kill', 'shell_run', 'wsl_run', 'ps_run', 'memory_sync'];
  config.jobs = config.jobs || {};
  config.jobs.file = config.jobs.file || 'memory/jobs.jsonl';
  config.jobs.max_attempts = config.jobs.max_attempts || 3;
  config.jobs.backoff_ms = config.jobs.backoff_ms || 2000;
  config.voice.tts = config.voice.tts || 'auto';
  config.vision = config.vision || {};
  return config;
}
function load() {
  if (cache) return cache;
  const raw = readJsonSync(path.join(ROOT, 'hugo.config.json'), null);
  if (!raw) throw new Error('hugo.config.json is missing or unreadable');
  const config = applyDefaults(applyEnv(deepMerge({}, raw)));
  config.version = (readTextSync(path.join(ROOT, 'VERSION'), raw.version || '0.0.0') || '').trim() || raw.version;
  config.root = ROOT;
  const paths = config.paths || {};
  config.dir = {
    data: path.join(ROOT, paths.data || 'data'), memory: path.join(ROOT, paths.memory || 'memory'),
    prompts: path.join(ROOT, paths.prompts || 'prompts'), docs: path.join(ROOT, paths.docs || 'docs'),
    state: path.join(ROOT, paths.state || '.hugo'), logs: path.join(ROOT, paths.logs || 'logs'),
  };
  const m = { ...config.memory };
  for (const key of ['facts', 'conversations', 'learned', 'notes', 'habits', 'todos', 'journal', 'graph', 'temporal', 'backlinks', 'embed_index', 'schedules', 'state']) {
    m[key] = resolvePath(m[key], `memory/${key.replace(/_/g, '-')}.json`);
  }
  config.file = {
    facts: path.join(ROOT, m.facts), conversations: path.join(ROOT, m.conversations), learned: path.join(ROOT, m.learned),
    notes: path.join(ROOT, m.notes), habits: path.join(ROOT, m.habits), todos: path.join(ROOT, m.todos), journal: path.join(ROOT, m.journal),
    graph: path.join(ROOT, m.graph), temporal: path.join(ROOT, m.temporal), backlinks: path.join(ROOT, m.backlinks),
    embedIndex: path.join(ROOT, m.embed_index), schedules: path.join(ROOT, m.schedules), state: path.join(ROOT, m.state),
    crm: path.join(ROOT, resolvePath(config.business.crm, 'memory/crm.jsonl')), campaigns: path.join(ROOT, resolvePath(config.business.campaigns, 'memory/campaigns.jsonl')),
    toolsCatalog: path.join(ROOT, resolvePath(config.tools.catalog, 'data/tools-full.json')), toolsStatus: path.join(ROOT, resolvePath(config.tools.status_file, 'data/tools-status.json')),
    agents: path.join(ROOT, 'data', 'agents-full.json'), intents: path.join(ROOT, 'data', 'intents.json'),
    adapters: path.join(ROOT, resolvePath(config.integrations.adapters, 'data/integration-adapters.json')), integrations: path.join(ROOT, resolvePath(config.integrations.registry, 'data/integrations.json')),
    mcp: path.join(ROOT, resolvePath(config.integrations.mcp, 'data/mcp-config.json')), log: path.join(ROOT, resolvePath(config.logging.file, 'logs/hugo.log')),
    jobs: path.join(ROOT, resolvePath(config.jobs.file, 'memory/jobs.jsonl')), confirmations: path.join(ROOT, 'memory/confirmations.json'),
    screenshots: path.join(ROOT, resolvePath(config.vision.capture_dir || config.browser.screenshot_dir, '.hugo/screenshots')),
  };
  cache = config;
  return config;
}
function validate() {
  const config = load();
  const errors = [];
  const warnings = [];
  for (const relative of ['hugo.config.json', 'VERSION', 'package.json', 'data/agents-full.json', 'data/tools-full.json']) {
    if (!fs.existsSync(path.join(ROOT, relative))) errors.push(`missing required file: ${relative}`);
  }
  for (const dir of Object.values(config.dir)) { try { ensureDir(dir); } catch (error) { errors.push(`cannot create ${dir}: ${error.message}`); } }
  for (const [name, value] of [['browser', config.browser.port], ['ui', config.ui.port], ['gateway', config.gateway.port]]) {
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push(`${name}.port invalid: ${value}`);
  }
  for (const key of ['ui', 'gateway']) if (config[key].host !== '127.0.0.1' && config[key].host !== 'localhost') warnings.push(`${key}.host is not local`);
  const dotEnv = loadDotEnv();
  return { ok: errors.length === 0, errors, warnings, version: config.version, root: ROOT, dot_env: dotEnv.loaded ? 'loaded' : 'not found' };
}
function describeEnv() {
  const config = load();
  return [
    { name: 'HUGO_LOCAL_AI_ENDPOINT', effect: 'адреса на локалниот AI; без него HUGO користи локални правила', set: Boolean(process.env.HUGO_LOCAL_AI_ENDPOINT) },
    { name: 'HUGO_LOCAL_AI_MODEL', effect: 'име на локалниот AI модел', set: Boolean(process.env.HUGO_LOCAL_AI_MODEL) },
    { name: 'OLLAMA_ENDPOINT', effect: 'локален Ollama endpoint (стандардно http://127.0.0.1:11434)', set: Boolean(process.env.OLLAMA_ENDPOINT || process.env.OLLAMA_HOST) },
    { name: 'OLLAMA_MODEL', effect: 'име на локалниот Ollama модел', set: Boolean(process.env.OLLAMA_MODEL) },
    { name: 'HUGO_VISION_ENDPOINT', effect: 'опционален локален сервис за слики/вид', set: Boolean(process.env.HUGO_VISION_ENDPOINT) },
    { name: 'HUGO_CHROME_PORT', effect: `port of your browser debug endpoint (default ${config.browser.port})`, set: Boolean(process.env.HUGO_CHROME_PORT) },
    { name: 'HUGO_CHROME_BIN', effect: 'path to Chrome/Chromium (auto-detected when empty)', set: Boolean(process.env.HUGO_CHROME_BIN) },
    { name: 'HUGO_CHROME_PROFILE', effect: 'profile directory used by HUGO (a copy of your real profile, so logins work)', set: Boolean(process.env.HUGO_CHROME_PROFILE) },
    { name: 'HUGO_DEVICE_TOKEN', effect: 'guards the local UI and gateway', set: Boolean(process.env.HUGO_DEVICE_TOKEN) },
    { name: 'HUGO_MEMORY_AUTO_PUSH', effect: 'commit and push memory with git', set: process.env.HUGO_MEMORY_AUTO_PUSH !== undefined },
    { name: 'HUGO_RETENTION_DAYS', effect: `conversation retention (default ${config.memory.retention_days})`, set: Boolean(process.env.HUGO_RETENTION_DAYS) },
    { name: 'HUGO_REPO', effect: `git remote for memory sync (default ${config.repo.url})`, set: Boolean(process.env.HUGO_REPO) },
    { name: 'HUGO_TZ', effect: `timezone for schedules and digests (default ${config.automation.timezone})`, set: Boolean(process.env.HUGO_TZ) },
    { name: 'HUGO_LOG_LEVEL', effect: 'error | warn | info | debug', set: Boolean(process.env.HUGO_LOG_LEVEL) },
  ];
}
function reset() { cache = null; }
module.exports = { ROOT, load, validate, describeEnv, reset, applyDefaults, envBool, envInt, envStr, deepMerge, resolvePath, loadDotEnv };
