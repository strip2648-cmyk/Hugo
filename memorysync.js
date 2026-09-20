'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readTextSync, listFiles, writeJsonSync } = require('../lib/fsx');
const config = require('../lib/config').load();
const SECRET_PATTERNS = [/(sk-[a-zA-Z0-9]{20,})/, /(ghp_[a-zA-Z0-9]{20,})/, /(AKIA[0-9A-Z]{16})/, /(xox[baprs]-[a-zA-Z0-9-]{10,})/, /(-----BEGIN [A-Z ]*PRIVATE KEY-----)/, /(eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.)/];
function scanSecrets(files) {
  const findings = [];
  for (const file of files) {
    const text = readTextSync(file, '');
    if (!text) continue;
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(text)) findings.push({ file: path.relative(config.root, file), pattern: String(pattern).slice(0, 40) });
    }
  }
  return findings;
}
function git(args) { return execFileSync('git', args, { cwd: config.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function syncOnce(options = {}) {
  if (!fs.existsSync(path.join(config.root, '.git'))) return { ok: false, reason: 'no git repository in ' + config.root };
  const memoryFiles = listFiles(config.dir.memory).map((name) => path.join(config.dir.memory, name));
  const findings = config.security.scan_secrets_before_sync ? scanSecrets(memoryFiles) : [];
  if (findings.length && !options.force) return { ok: false, reason: 'possible secrets found, refusing to push', findings };
  git(['add', '--', 'memory']);
  const status = git(['status', '--porcelain', '--', 'memory']);
  if (!status) return { ok: true, changed: false };
  git(['-c', 'user.name=Hugo Bot', '-c', 'user.email=hugo@users.noreply.github.com', 'commit', '-m', options.message || 'Memory sync ' + new Date().toISOString()]);
  if (options.push === false || config.memory.auto_push === false) return { ok: true, changed: true, pushed: false };
  try { git(['push', config.repo.remote || 'origin', config.repo.branch || 'main']); return { ok: true, changed: true, pushed: true }; }
  catch (error) { return { ok: true, changed: true, pushed: false, push_error: error.message }; }
}
function exportTo(file) {
  const store = require('../memory/store');
  const bundle = store.exportBundle();
  const target = file || path.join(config.dir.state, 'memory-backup.json');
  writeJsonSync(target, bundle);
  return { file: target, facts: bundle.counts.facts, conversations: bundle.counts.conversations };
}
async function importFrom(file) {
  const store = require('../memory/store');
  const target = file || path.join(config.dir.state, 'memory-backup.json');
  const bundle = JSON.parse(readTextSync(target, '{}'));
  return store.importBundle(bundle);
}
function actions() {
  return [
    { name: 'memory_sync', category: 'automation', description: '\u0417\u0430\u0447\u0443\u0432\u0430\u0458 \u043c\u0435\u043c\u043e\u0440\u0438\u0458\u0430 \u0432\u043e Git (\u0441\u043e \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u0437\u0430 \u0442\u0430\u0458\u043d\u0438)', params: {}, handler: async (input) => syncOnce(input) },
    { name: 'memory_backup', category: 'automation', description: '\u041d\u0430\u043f\u0440\u0430\u0432\u0438 \u0431\u0435\u043a\u0430\u043f \u043d\u0430 \u043c\u0435\u043c\u043e\u0440\u0438\u0458\u0430\u0442\u0430', params: { file: 'string' }, handler: async (input) => exportTo(input.file) },
    { name: 'memory_restore', category: 'automation', description: '\u0412\u0440\u0430\u0442\u0438 \u043c\u0435\u043c\u043e\u0440\u0438\u0458\u0430 \u043e\u0434 \u0431\u0435\u043a\u0430\u043f', params: { file: 'string' }, handler: async (input) => importFrom(input.file) },
    { name: 'secrets_scan', category: 'security', description: '\u041f\u0440\u043e\u0432\u0435\u0440\u0438 \u043c\u0435\u043c\u043e\u0440\u0438\u0458\u0430\u0442\u0430 \u0437\u0430 \u0442\u0430\u0458\u043d\u0438', params: {}, handler: async () => ({ findings: scanSecrets(listFiles(config.dir.memory).map((name) => path.join(config.dir.memory, name))) }) },
  ];
}
module.exports = { syncOnce, exportTo, importFrom, scanSecrets, actions };
