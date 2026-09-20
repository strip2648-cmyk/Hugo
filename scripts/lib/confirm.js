'use strict';

const crypto = require('node:crypto');
const config = require('./config').load();
const { readJsonSync, writeJsonSync } = require('./fsx');
const { shortId } = require('./ids');
const { InputError } = require('./errors');
function store() { return config.file.confirmations; }
function load() { const d = readJsonSync(store(), { tokens: [] }); return { tokens: Array.isArray(d.tokens) ? d.tokens : [] }; }
function save(d) { return writeJsonSync(store(), d); }
function signature(action, args) { return crypto.createHash('sha256').update(JSON.stringify({ action: String(action || ''), args: args || {} })).digest('hex').slice(0, 16); }
function ttl() { return Number((config.confirm && config.confirm.ttl_ms) || 600000); }
function prune(d) { const now = Date.now(); return { tokens: (d.tokens || []).filter((t) => Date.parse(t.expires_at) > now) }; }
function required(action) { return ((config.confirm && config.confirm.require) || []).includes(String(action || '')); }
function request(input = {}) {
  const action = String(input.action || '').trim();
  if (!action) throw new InputError('потврдата бара акција');
  const data = prune(load());
  const token = { id: shortId('confirm'), action, args: input.args || {}, signature: signature(action, input.args), reason: input.reason || 'потребна е твоја изрична потврда', destructive: Boolean(input.destructive), status: 'pending', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + ttl()).toISOString() };
  data.tokens = data.tokens.filter((t) => !(t.status === 'pending' && t.signature === token.signature)).concat(token);
  save(data);
  return { needs_confirmation: true, confirmation_id: token.id, action, args: token.args, reason: token.reason, destructive: token.destructive, expires_at: token.expires_at, how_to_confirm: 'кажи „потврди ' + token.id + '“ или повикај confirm_approve со {"id":"' + token.id + '"}' };
}
function find(id) { return prune(load()).tokens.find((t) => t.id === id) || null; }
function approve(id) {
  const data = prune(load());
  const token = data.tokens.find((t) => t.id === id);
  if (!token) throw new InputError('непозната или истечена потврда: ' + id);
  token.status = 'approved'; token.approved_at = new Date().toISOString(); save(data);
  return { approved: true, confirmation_id: token.id, action: token.action, args: token.args };
}
function deny(id) {
  const data = prune(load());
  const token = data.tokens.find((t) => t.id === id);
  if (!token) throw new InputError('непозната или истечена потврда: ' + id);
  token.status = 'denied'; token.denied_at = new Date().toISOString(); save(data);
  return { denied: true, confirmation_id: token.id, action: token.action };
}
function pending(action) {
  const tokens = prune(load()).tokens.filter((t) => t.status === 'pending');
  return (action ? tokens.filter((t) => t.action === action) : tokens).map((t) => ({ id: t.id, action: t.action, args: t.args, reason: t.reason, destructive: t.destructive, expires_at: t.expires_at }));
}
function consume(action, args) {
  const data = prune(load());
  const wanted = signature(action, args);
  const token = data.tokens.find((t) => t.status === 'approved' && (t.signature === wanted || (t.action === action && JSON.stringify(t.args) === JSON.stringify(args || {}))));
  if (!token) return null;
  token.status = 'used'; token.used_at = new Date().toISOString(); save(data);
  return { id: token.id, action: token.action, approved_at: token.approved_at };
}
function ensure(action, args) {
  if (args && args.confirm === true) return { ok: true, explicit: true };
  const used = consume(action, args);
  if (used) return { ok: true, via_token: used.id };
  return { ok: false, gate: request({ action, args, destructive: true }) };
}
function approveLatest(action) {
  const tokens = pending(action);
  if (!tokens.length) return { approved: false, reason: 'нема потврда што чека за ' + (action || 'ниту една акција') };
  return approve(tokens[tokens.length - 1].id);
}
function actions() {
  return [
    { name: 'confirm_pending', category: 'confirm', safety: 'read', description: 'Што чека твоја потврда', params: { action: 'string' }, handler: async (input) => pending(input.action) },
    { name: 'confirm_approve', category: 'confirm', safety: 'write', description: 'Потврди акција', params: { id: 'string', action: 'string' }, handler: async (input) => (input.id ? approve(input.id) : approveLatest(input.action)) },
    { name: 'confirm_deny', category: 'confirm', safety: 'write', description: 'Одбиј акција', params: { id: 'string' }, handler: async (input) => deny(input.id) },
    { name: 'confirm_request', category: 'confirm', safety: 'read', description: 'Побарај потврда', params: { action: 'string', args: 'object' }, handler: async (input) => request(input) },
  ];
}
module.exports = { required, request, approve, deny, pending, consume, ensure, approveLatest, signature, find, actions, store };
