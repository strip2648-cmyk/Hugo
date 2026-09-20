'use strict';
const vm = require('node:vm');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { InputError } = require('../../lib/errors');
const tools = {
  execute_js: { category: 'code', description: '\u0418\u0437\u0432\u0440\u0448\u0438 JavaScript \u043b\u043e\u043a\u0430\u043b\u043d\u043e (\u043f\u0435\u0441\u043e\u043a)', params: { code: 'string' }, run: async (args) => {
    const code = String(args.code || '').trim();
    if (!code) throw new InputError('code is required');
    const logs = [];
    const sandbox = { console: { log: (...parts) => logs.push(parts.map(String).join(' ')), error: (...parts) => logs.push('ERR ' + parts.map(String).join(' ')) }, Math, JSON, Date, Number, String, Boolean, Array, Object, RegExp, Map, Set };
    const result = vm.runInContext(code, vm.createContext(sandbox), { timeout: 5000, displayErrors: true });
    return { result: result === undefined ? null : result, logs, timeout_seconds: 5 };
  } },
  execute_python: { category: 'code', description: '\u0418\u0437\u0432\u0440\u0448\u0438 Python \u043b\u043e\u043a\u0430\u043b\u043d\u043e', params: { code: 'string' }, run: async (args) => {
    const code = String(args.code || '').trim();
    if (!code) throw new InputError('code is required');
    const result = spawnSync('python3', ['-c', code], { encoding: 'utf8', timeout: 15000, maxBuffer: 1048576 });
    if (result.error) throw new InputError('python3 is not available: ' + result.error.message);
    return { stdout: result.stdout, stderr: result.stderr, exit_code: result.status };
  } },
  json_format: { category: 'code', description: '\u0424\u043e\u0440\u043c\u0430\u0442\u0438\u0440\u0430\u0458 JSON', params: { json: 'string|object' }, run: async (args) => {
    const value = typeof args.json === 'string' ? JSON.parse(args.json) : args.json;
    return { formatted: JSON.stringify(value, null, args.indent === undefined ? 2 : Number(args.indent)) };
  } },
  base64_encode: { category: 'code', description: 'Base64 \u0435\u043d\u043a\u043e\u0434\u0438\u0440\u0430\u045a\u0435', params: { text: 'string' }, run: async (args) => ({ encoded: Buffer.from(String(args.text || ''), 'utf8').toString('base64') }) },
  base64_decode: { category: 'code', description: 'Base64 \u0434\u0435\u043a\u043e\u0434\u0438\u0440\u0430\u045a\u0435', params: { text: 'string' }, run: async (args) => ({ decoded: Buffer.from(String(args.text || ''), 'base64').toString('utf8') }) },
  url_encode: { category: 'code', description: 'URL \u0435\u043d\u043a\u043e\u0434\u0438\u0440\u0430\u045a\u0435', params: { text: 'string' }, run: async (args) => ({ encoded: encodeURIComponent(String(args.text || '')) }) },
  url_decode: { category: 'code', description: 'URL \u0434\u0435\u043a\u043e\u0434\u0438\u0440\u0430\u045a\u0435', params: { text: 'string' }, run: async (args) => ({ decoded: decodeURIComponent(String(args.text || '')) }) },
  hash_text: { category: 'code', description: 'MD5/SHA \u0445\u0435\u0448', params: { text: 'string', algorithm: 'md5|sha1|sha256|sha512' }, run: async (args) => {
    const algorithm = String(args.algorithm || 'sha256').toLowerCase();
    if (!['md5', 'sha1', 'sha256', 'sha512'].includes(algorithm)) throw new InputError('unsupported algorithm');
    return { algorithm, hash: crypto.createHash(algorithm).update(String(args.text || ''), 'utf8').digest('hex') };
  } },
  regex_test: { category: 'code', description: '\u0422\u0435\u0441\u0442\u0438\u0440\u0430\u0458 \u0440\u0435\u0433\u0443\u043b\u0430\u0440\u0435\u043d \u0438\u0437\u0440\u0430\u0437', params: { pattern: 'string', text: 'string', flags: 'string' }, run: async (args) => {
    const pattern = String(args.pattern || '');
    if (!pattern) throw new InputError('pattern is required');
    const flags = String(args.flags || 'g').includes('g') ? String(args.flags || 'g') : String(args.flags || 'g') + 'g';
    const matches = [...String(args.text || '').matchAll(new RegExp(pattern, flags))];
    return { count: matches.length, matches: matches.slice(0, 25).map((match) => ({ value: match[0], groups: match.slice(1) })) };
  } },
  diff_check: { category: 'code', description: '\u0421\u043f\u043e\u0440\u0435\u0434\u0438 \u0434\u0432\u0430 \u0442\u0435\u043a\u0441\u0442\u0430', params: { left: 'string', right: 'string' }, run: async (args) => {
    const left = String(args.left || '').split('\n');
    const right = String(args.right || '').split('\n');
    const differences = [];
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) if ((left[index] || '') !== (right[index] || '')) differences.push({ line: index + 1, left: left[index] || null, right: right[index] || null });
    return { identical: differences.length === 0, total_differences: differences.length, differences: differences.slice(0, 50) };
  } },
  csv_tool: { category: 'code', description: '\u041f\u0430\u0440\u0441\u0438\u0440\u0430\u0458 CSV', params: { csv: 'string', delimiter: 'string' }, run: async (args) => {
    const delimiter = String(args.delimiter || ',');
    const rows = String(args.csv || '').split('\n').filter(Boolean).map((line) => line.split(delimiter));
    return { rows: rows.length, columns: rows.length ? rows[0].length : 0, header: rows[0] || [], preview: rows.slice(1, 6) };
  } },
};
module.exports = { tools };
