'use strict';
const fs = require('node:fs');
const path = require('node:path');
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); return dir; }
function readTextSync(file, fallback = null) {
  try { return fs.readFileSync(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
function readJsonSync(file, fallback = {}) {
  const text = readTextSync(file, null);
  if (text === null || !text.trim()) return fallback;
  try { return JSON.parse(text); } catch (error) { throw new Error(`Invalid JSON in ${file}: ${error.message}`); }
}
function writeJsonSync(file, value) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
  return value;
}
function appendJsonlSync(file, row) { ensureDir(path.dirname(file)); fs.appendFileSync(file, `${JSON.stringify(row)}\n`, 'utf8'); return row; }
function readJsonlSync(file, limit = 0) {
  const text = readTextSync(file, '');
  if (!text) return [];
  const rows = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { rows.push(JSON.parse(trimmed)); } catch { /* skip corrupt line */ }
  }
  return limit > 0 ? rows.slice(-limit) : rows;
}
function writeJsonlSync(file, rows) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, rows.length ? `${rows.map((row) => JSON.stringify(row)).join('\n')}\n` : '', 'utf8');
  fs.renameSync(tmp, file);
  return rows.length;
}
function exists(file) { return fs.existsSync(file); }
function size(file) { try { return fs.statSync(file).size; } catch { return 0; } }
function removeFile(file) { try { fs.unlinkSync(file); return true; } catch { return false; } }
function listFiles(dir, ext = '') { try { return fs.readdirSync(dir).filter((name) => !ext || name.endsWith(ext)).sort(); } catch { return []; } }
module.exports = { ensureDir, readTextSync, readJsonSync, writeJsonSync, appendJsonlSync, readJsonlSync, writeJsonlSync, exists, size, removeFile, listFiles };
