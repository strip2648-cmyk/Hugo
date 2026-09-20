'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../../lib/config').load();
const { InputError, NotFoundError } = require('../../lib/errors');
const host = require('../../host/host');
const confirm = require('../../lib/confirm');
const S = (v) => String(v == null ? '' : v);
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function target(input, key = 'path') {
  const value = input && input[key];
  if (!value) throw new InputError(key + ' е задолжително');
  return host.assertAllowed(host.resolvePath(value));
}
function readText(f) { return fs.readFileSync(f, 'utf8'); }
function walk(root, options = {}) {
  const maxDepth = Number(options.max_depth === undefined ? 3 : options.max_depth);
  const limit = Number(options.limit || 500);
  const includeHidden = options.include_hidden === true;
  const out = [];
  const stack = [{ dir: root, depth: 0 }];
  const skip = new Set(['node_modules', '.git', '.cache', 'venv', '__pycache__']);
  while (stack.length && out.length < limit) {
    const { dir, depth } = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!includeHidden && e.name.startsWith('.')) continue;
      if (e.isDirectory() && skip.has(e.name)) continue;
      const full = path.join(dir, e.name);
      let st = null; try { st = fs.statSync(full); } catch { st = null; }
      out.push({ path: full, name: e.name, dir: e.isDirectory(), bytes: st ? st.size : 0, modified_at: st ? st.mtime.toISOString() : null });
      if (out.length >= limit) break;
      if (e.isDirectory() && depth < maxDepth) stack.push({ dir: full, depth: depth + 1 });
    }
  }
  return out;
}
function matcher(pattern, caseSensitive) {
  if (!pattern) return () => true;
  const source = S(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return (v) => new RegExp('^' + source + '$', caseSensitive ? '' : 'i').test(v);
}
async function fileWrite(input = {}) {
  const file = target(input);
  const buf = input.base64 ? Buffer.from(S(input.content), 'base64') : Buffer.from(S(input.content), input.encoding || 'utf8');
  const mode = input.mode || 'overwrite';
  if (mode === 'create_only' && fs.existsSync(file)) throw new InputError('фајлот веќе постои: ' + file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (mode === 'append') fs.appendFileSync(file, buf); else fs.writeFileSync(file, buf);
  const written = fs.readFileSync(file);
  return { ok: true, path: file, mode, bytes: written.length, sha256: sha256(written), verified: input.base64 ? true : written.toString('utf8') === S(input.content), verified_how: input.base64 ? 'запишани бајти' : 'повторно прочитано и споредено' };
}
async function fileRead(input = {}) {
  const file = target(input);
  if (!fs.existsSync(file)) throw new NotFoundError('фајлот не постои: ' + file);
  const stat = fs.statSync(file);
  if (stat.isDirectory()) throw new InputError('ова е папка: ' + file);
  const maxBytes = Number(input.max_bytes || config.files.max_read_bytes);
  const raw = fs.readFileSync(file);
  const slice = raw.slice(0, maxBytes);
  const text = slice.toString(input.encoding || 'utf8');
  let body = text;
  if (input.start_line || input.end_line) {
    const lines = text.split('\n');
    body = lines.slice(Math.max(0, Number(input.start_line || 1) - 1), Number(input.end_line || lines.length)).join('\n');
  }
  return { ok: true, path: file, bytes: stat.size, truncated: raw.length > maxBytes, sha256: sha256(slice), lines: text.split('\n').length, content: body, verified: true };
}
async function fileEdit(input = {}) {
  const file = target(input);
  if (!input.find) throw new InputError('find е задолжително');
  if (!fs.existsSync(file)) throw new NotFoundError('фајлот не постои: ' + file);
  const before = readText(file);
  let after = before; let count = 0;
  if (input.regex) {
    const re = new RegExp(S(input.find), input.replace_all ? 'g' : '');
    count = (before.match(re) || []).length;
    after = before.replace(re, S(input.replace));
  } else {
    count = before.split(S(input.find)).length - 1;
    after = input.replace_all ? before.split(S(input.find)).join(S(input.replace)) : before.replace(S(input.find), S(input.replace));
    if (!input.replace_all && count > 1) count = 1;
  }
  fs.writeFileSync(file, after);
  return { ok: count > 0, path: file, replaced: count, bytes_before: before.length, bytes_after: after.length, verified: readText(file) === after };
}
async function fileList(input = {}) {
  const dir = target(input);
  if (!fs.existsSync(dir)) throw new NotFoundError('не постои: ' + dir);
  if (!fs.statSync(dir).isDirectory()) return { ok: true, path: dir, total: 1, files: [{ path: dir, dir: false, bytes: fs.statSync(dir).size }] };
  let rows = input.recursive === true ? walk(dir, input) : fs.readdirSync(dir, { withFileTypes: true }).filter((e) => input.include_hidden === true || !e.name.startsWith('.')).map((e) => {
    const full = path.join(dir, e.name);
    let st = null; try { st = fs.statSync(full); } catch {}
    return { path: full, name: e.name, dir: e.isDirectory(), bytes: st ? st.size : 0, modified_at: st ? st.mtime.toISOString() : null };
  });
  if (input.pattern) { const test = matcher(input.pattern, input.case_sensitive === true); rows = rows.filter((r) => test(r.name)); }
  return { ok: true, path: dir, total: rows.length, files: rows.slice(0, Number(input.limit || 500)) };
}
async function fileTree(input = {}) {
  const dir = target(input);
  const rows = walk(dir, { max_depth: input.depth === undefined ? 2 : input.depth, limit: input.limit || 400, include_hidden: input.include_hidden === true });
  const lines = [dir].concat(rows.map((r) => '  '.repeat(Math.max(0, r.path.replace(dir, '').split(path.sep).length - 1)) + (r.dir ? '[D] ' : '    ') + r.name));
  return { ok: true, root: dir, entries: rows.length, tree: lines.join('\n'), files: rows };
}
async function fileSearch(input = {}) {
  const root = target(input);
  const rows = walk(root, { max_depth: input.max_depth === undefined ? 6 : input.max_depth, limit: Number(input.max_results || 50) * 20, include_hidden: input.include_hidden === true });
  const nameTest = input.name_pattern ? matcher(input.name_pattern, input.case_sensitive === true) : null;
  const needle = input.content_pattern ? (input.regex_content ? new RegExp(S(input.content_pattern), input.case_sensitive ? '' : 'i') : S(input.content_pattern)) : null;
  const hits = [];
  for (const row of rows) {
    if (row.dir) continue;
    if (nameTest && !nameTest(row.name)) continue;
    if (!needle) hits.push({ path: row.path, name: row.name, bytes: row.bytes, match: 'name' });
    else if (row.bytes < 2000000) {
      let text = ''; try { text = fs.readFileSync(row.path, 'utf8'); } catch { continue; }
      const tests = needle instanceof RegExp ? needle.test(text) : text.includes(needle);
      if (tests) {
        const lines = text.split('\n');
        const index = lines.findIndex((entry) => (needle instanceof RegExp ? needle.test(entry) : entry.includes(needle)));
        hits.push({ path: row.path, name: row.name, bytes: row.bytes, line: index + 1, snippet: index >= 0 ? lines[index].trim().slice(0, 200) : null, match: 'content' });
      }
    }
    if (hits.length >= Number(input.max_results || 50)) break;
  }
  return { ok: true, root, scanned: rows.length, total: hits.length, hits };
}
async function fileMkdir(input = {}) {
  const dir = target(input);
  fs.mkdirSync(dir, { recursive: input.recursive !== false });
  return { ok: true, path: dir, created: fs.existsSync(dir), verified: fs.existsSync(dir) };
}
async function fileCopy(input = {}) {
  const from = target(input, 'from');
  const to = host.assertAllowed(host.resolvePath(input.to || ''));
  if (!fs.existsSync(from)) throw new NotFoundError('изворот не постои: ' + from);
  if (fs.existsSync(to) && input.overwrite !== true) throw new InputError('целта постои (додај overwrite:true): ' + to);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, force: true });
  return { ok: true, from, to, verified: fs.existsSync(to) };
}
async function fileMove(input = {}) {
  const from = target(input, 'from');
  const to = host.assertAllowed(host.resolvePath(input.to || ''));
  if (!fs.existsSync(from)) throw new NotFoundError('изворот не постои: ' + from);
  if (fs.existsSync(to) && input.overwrite !== true) throw new InputError('целта постои (додај overwrite:true): ' + to);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  return { ok: true, from, to, verified: fs.existsSync(to) && !fs.existsSync(from) };
}
async function fileDelete(input = {}) {
  const file = target(input);
  if (!fs.existsSync(file)) return { ok: true, path: file, deleted: false, note: 'веќе не постои' };
  if (input.permanent === true) {
    const gate = confirm.ensure('file_delete', input);
    if (!gate.ok) return gate.gate;
    fs.rmSync(file, { recursive: true, force: true });
    return { ok: true, path: file, deleted: true, permanent: true, verified: !fs.existsSync(file) };
  }
  const stamped = path.join(host.trashDir(), Date.now() + '-' + path.basename(file));
  try {
    fs.renameSync(file, stamped);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    fs.cpSync(file, stamped, { recursive: true, force: true });
    fs.rmSync(file, { recursive: true, force: true });
  }
  return { ok: true, path: file, deleted: true, moved_to: stamped, recoverable: true, verified: !fs.existsSync(file) && fs.existsSync(stamped) };
}
async function fileStat(input = {}) {
  const file = target(input);
  if (!fs.existsSync(file)) return { ok: true, path: file, exists: false };
  const stat = fs.statSync(file);
  return { ok: true, path: file, exists: true, dir: stat.isDirectory(), bytes: stat.size, created_at: stat.birthtime.toISOString(), modified_at: stat.mtime.toISOString(), mapped: host.describe(file) };
}
async function fileHash(input = {}) {
  const file = target(input);
  if (!fs.existsSync(file)) throw new NotFoundError('фајлот не постои: ' + file);
  return { ok: true, path: file, sha256: sha256(fs.readFileSync(file)), bytes: fs.statSync(file).size };
}
async function pathResolve(input = {}) {
  const resolved = host.resolvePath(input.path);
  let allowed = true;
  try { host.assertAllowed(resolved); } catch (error) { allowed = error.message; }
  return { ok: true, ...host.describe(resolved), allowed };
}
const tools = {
  file_write: { category: 'files', description: 'Направи или препиши фајл (со верификација)', params: { path: 'string', content: 'string', mode: 'overwrite|append|create_only' }, run: fileWrite },
  file_read: { category: 'files', description: 'Читај фајл', params: { path: 'string', max_bytes: 'number' }, run: fileRead },
  file_append: { category: 'files', description: 'Додај во фајл', params: { path: 'string', content: 'string' }, run: async (input) => fileWrite({ ...input, mode: 'append' }) },
  file_edit: { category: 'files', description: 'Замени дел од фајл', params: { path: 'string', find: 'string', replace: 'string' }, run: fileEdit },
  file_list: { category: 'files', description: 'Листа фајлови во папка', params: { path: 'string', pattern: 'string' }, run: fileList },
  file_tree: { category: 'files', description: 'Дрво на папка', params: { path: 'string', depth: 'number' }, run: fileTree },
  file_search: { category: 'files', description: 'Пребарај фајлови по име или содржина', params: { path: 'string', name_pattern: 'string', content_pattern: 'string' }, run: fileSearch },
  file_mkdir: { category: 'files', description: 'Направи папка', params: { path: 'string' }, run: fileMkdir },
  file_copy: { category: 'files', description: 'Копирај фајл или папка', params: { from: 'string', to: 'string' }, run: fileCopy },
  file_move: { category: 'files', description: 'Премести фајл или папка', params: { from: 'string', to: 'string' }, run: fileMove },
  file_delete: { category: 'files', description: 'Избриши (во корпа; трајно само со потврда)', params: { path: 'string', recursive: 'boolean', permanent: 'boolean' }, run: fileDelete },
  file_stat: { category: 'files', description: 'Информации за фајл', params: { path: 'string' }, run: fileStat },
  file_hash: { category: 'files', description: 'SHA-256 на фајл', params: { path: 'string' }, run: fileHash },
  path_resolve: { category: 'files', description: 'Како HUGO гледа на патеката (Windows/WSL)', params: { path: 'string' }, run: pathResolve },
};
module.exports = { tools, walk };
