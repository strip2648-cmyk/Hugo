'use strict';
const crypto = require('node:crypto');
function hashId(text, length = 16) { return crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, length); }
function uuid() { return crypto.randomUUID(); }
function shortId(prefix = 'id') { return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`; }
module.exports = { hashId, uuid, shortId };
