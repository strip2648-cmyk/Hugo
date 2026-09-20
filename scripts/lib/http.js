'use strict';
const { NetworkError, BlockedError } = require('./errors');
const config = require('./config').load();
const UA_MAP = { default: 'Mozilla/5.0 (compatible; HugoCore/6.0; +https://github.com/klikmarkettt-dotcom/hugo-core)', browser: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
function guardUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new NetworkError(`invalid URL: ${url}`); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new NetworkError(`unsupported protocol: ${parsed.protocol}`);
  const host = parsed.hostname;
  if ((config.security.deny_hosts || []).includes(host)) throw new BlockedError(`host blocked by config: ${host}`);
  const allowed = config.security.allowed_hosts || [];
  if (allowed.length && !allowed.some((entry) => host.endsWith(entry))) throw new BlockedError(`host not in allowed_hosts: ${host}`);
  return parsed;
}
async function request(url, options = {}) {
  guardUrl(url);
  const attempts = (options.retries === undefined ? config.tools.retries : options.retries) + 1;
  const timeout = options.timeout_ms || config.tools.timeout_ms;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const started = Date.now();
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: { accept: options.accept || 'application/json, text/html;q=0.9, */*;q=0.5', 'user-agent': UA_MAP[options.ua || 'default'], ...(options.headers || {}) },
        body: options.body,
        signal: AbortSignal.timeout(timeout),
        redirect: 'follow',
      });
      const ms = Date.now() - started;
      const text = options.method === 'HEAD' ? '' : await response.text();
      const result = { ok: response.ok, status: response.status, url: response.url || url, headers: Object.fromEntries(response.headers.entries()), text, ms, attempt };
      if (!response.ok) {
        const error = response.status === 403 || response.status === 429 ? new BlockedError(`HTTP ${response.status} from ${url}`, { status: response.status, url })
          : new NetworkError(`HTTP ${response.status} from ${url}`, { status: response.status, url });
        if (attempt < attempts && response.status >= 500) { lastError = error; continue; }
        throw error;
      }
      return result;
    } catch (error) {
      lastError = error;
      if (error.name === 'TimeoutError' || error.name === 'AbortError') lastError = new NetworkError(`timeout after ${timeout}ms: ${url}`);
      if (attempt >= attempts) break;
    }
  }
  throw lastError || new NetworkError(`request failed: ${url}`);
}
async function getJson(url, options = {}) {
  const response = await request(url, { ...options, retries: options.retries });
  try { return { ...JSON.parse(response.text), __http: { status: response.status, ms: response.ms, url: response.url } }; }
  catch { throw new NetworkError(`invalid JSON from ${url}`, { status: response.status }); }
}
async function getText(url, options = {}) { return request(url, options); }
async function head(url, options = {}) { return request(url, { ...options, method: 'HEAD' }); }
module.exports = { request, getJson, getText, head, guardUrl, UA_MAP };
