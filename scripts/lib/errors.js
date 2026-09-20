'use strict';
class HugoError extends Error {
  constructor(message, code = 'HUGO_ERROR', details = {}) { super(message); this.name = new.target.name; this.code = code; this.details = details; }
  toJSON() { return { name: this.name, code: this.code, message: this.message, details: this.details }; }
}
class InputError extends HugoError { constructor(m, d = {}) { super(m, 'HUGO_INPUT', d); } }
class NotFoundError extends HugoError { constructor(m, d = {}) { super(m, 'HUGO_NOT_FOUND', d); } }
class NetworkError extends HugoError { constructor(m, d = {}) { super(m, 'HUGO_NETWORK', d); } }
class BlockedError extends HugoError { constructor(m, d = {}) { super(m, 'HUGO_BLOCKED', d); } }
class AuthError extends HugoError { constructor(m, d = {}) { super(m, 'HUGO_AUTH', d); } }
class UnsupportedError extends HugoError { constructor(m, d = {}) { super(m, 'HUGO_UNSUPPORTED', d); } }
function isHugoError(error) { return error instanceof HugoError || Boolean(error && error.code && String(error.code).startsWith('HUGO_')); }
function toEnvelope(error, action = null) {
  if (isHugoError(error)) return { ok: false, action, error: { code: error.code, message: error.message, details: error.details || {} } };
  return { ok: false, action, error: { code: 'HUGO_ERROR', message: error && error.message ? error.message : String(error), details: {} } };
}
module.exports = { HugoError, InputError, NotFoundError, NetworkError, BlockedError, AuthError, UnsupportedError, isHugoError, toEnvelope };
