'use strict';
const fs = require('node:fs');
const path = require('node:path');
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
let filePath = null;
let minLevel = LEVELS[process.env.HUGO_LOG_LEVEL || 'info'] ?? LEVELS.info;
let silent = false;
function configure(options = {}) {
  if (options.level && LEVELS[options.level] !== undefined) minLevel = LEVELS[options.level];
  if (options.file) { filePath = options.file; fs.mkdirSync(path.dirname(filePath), { recursive: true }); }
  if (options.silent !== undefined) silent = options.silent;
}
function emit(level, scope, message, meta) {
  if (LEVELS[level] > minLevel) return undefined;
  const at = new Date().toISOString();
  if (filePath) { try { fs.appendFileSync(filePath, `${JSON.stringify({ at, level, scope, message, meta })}\n`, 'utf8'); } catch { /* never break a run for logging */ } }
  const line = `[${at}] ${level.toUpperCase()} ${scope} ${message}${meta ? ` ${JSON.stringify(meta)}` : ''}`;
  if (silent) return { at, level, scope, message, meta };
  if (level === 'error') console.error(line); else if (level === 'warn') console.warn(line); else console.log(line);
  return { at, level, scope, message, meta };
}
function createLogger(scope = 'hugo') {
  return {
    error: (message, meta) => emit('error', scope, message, meta),
    warn: (message, meta) => emit('warn', scope, message, meta),
    info: (message, meta) => emit('info', scope, message, meta),
    debug: (message, meta) => emit('debug', scope, message, meta),
    child: (child) => createLogger(`${scope}:${child}`),
  };
}
module.exports = { createLogger, configure, LEVELS };
