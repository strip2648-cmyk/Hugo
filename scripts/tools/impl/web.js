'use strict';
const tls = require('node:tls');
const { getJson, getText, head, request } = require('../../lib/http');
const { stripHtml, extractTitle, extractLinks, extractForms } = require('../../lib/textutil');
const tools = {
  wikipedia: { category: 'web', description: '\u0412\u0438\u043a\u0438\u043f\u0435\u0434\u0438\u0458\u0430 \u0437\u0430 \u0442\u0435\u043c\u0430 (\u0431\u0435\u0437 \u043a\u043b\u0443\u0447)', params: { query: 'string', lang: 'mk|en' }, run: async (args) => {
    const query = String(args.query || args.text || '').trim();
    if (!query) throw new Error('query is required');
    const lang = args.lang === 'en' ? 'en' : 'mk';
    const search = await getJson(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1`, { timeout_ms: 15000 });
    const hit = search.query && search.query.search && search.query.search[0];
    if (!hit) throw new Error(`nothing found on wikipedia for: ${query}`);
    const summary = await getJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`, { timeout_ms: 15000 });
    return { title: summary.title, description: summary.description, extract: summary.extract, url: summary.content_urls && summary.content_urls.desktop && summary.content_urls.desktop.page, language: lang };
  } },
  whois_lookup: { category: 'web', description: 'WHOIS/RDAP \u0437\u0430 \u0434\u043e\u043c\u0435\u043d (\u0431\u0435\u0437 \u043a\u043b\u0443\u0447)', params: { domain: 'string' }, run: async (args) => {
    const domain = String(args.domain || args.query || '').replace(/^https?:\/\//, '').split('/')[0];
    if (!domain) throw new Error('domain is required');
    const data = await getJson(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { timeout_ms: 20000 });
    const events = (data.events || []).map((event) => ({ action: event.eventAction, date: event.eventDate }));
    const registrar = (data.entities || []).find((entity) => (entity.roles || []).includes('registrar'));
    return { domain: data.ldhName || domain, status: data.status, events, registrar: registrar ? ((registrar.vcardArray && registrar.vcardArray[1] || []).find((field) => field[0] === 'fn') || [])[3] : null, nameservers: (data.nameservers || []).map((server) => server.ldhName) };
  } },
  dns_lookup: { category: 'web', description: 'DNS \u0437\u0430\u043f\u0438\u0441\u0438 (\u0431\u0435\u0437 \u043a\u043b\u0443\u0447)', params: { domain: 'string', type: 'A|AAAA|MX|TXT|NS|CNAME' }, run: async (args) => {
    const domain = String(args.domain || args.query || '').replace(/^https?:\/\//, '').split('/')[0];
    if (!domain) throw new Error('domain is required');
    const type = String(args.type || 'A').toUpperCase();
    const data = await getJson(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`, { timeout_ms: 15000 });
    return { domain, type, status: data.Status, answers: (data.Answer || []).map((answer) => ({ name: answer.name, type: answer.type, ttl: answer.TTL, data: answer.data })) };
  } },
  ssl_check: { category: 'web', description: 'SSL \u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442 (\u0432\u0438\u0441\u0442\u0438\u043d\u0441\u043a\u0430 TLS \u0432\u0440\u0441\u043a\u0430)', params: { host: 'string', port: 'number' }, run: async (args) => {
    const host = String(args.host || args.domain || args.query || '').replace(/^https?:\/\//, '').split('/')[0];
    if (!host) throw new Error('host is required');
    const port = Number(args.port) || 443;
    return new Promise((resolve, reject) => {
      const socket = tls.connect({ host, port, servername: host, timeout: 12000 }, () => {
        const certificate = socket.getPeerCertificate();
        const validTo = new Date(certificate.valid_to);
        resolve({
          host, port, authorized: socket.authorized, authorization_error: socket.authorizationError || null,
          subject: certificate.subject, issuer: certificate.issuer, valid_from: certificate.valid_from, valid_to: certificate.valid_to,
          days_left: Math.round((validTo.getTime() - Date.now()) / 86400000), protocol: socket.getProtocol(), fingerprint256: certificate.fingerprint256,
        });
        socket.end();
      });
      socket.on('timeout', () => { socket.destroy(); reject(new Error(`TLS timeout for ${host}:${port}`)); });
      socket.on('error', (error) => reject(new Error(`TLS error for ${host}:${port}: ${error.message}`)));
    });
  } },
  ping_url: { category: 'web', description: '\u041f\u0440\u043e\u0432\u0435\u0440\u0438 \u0434\u0430\u043b\u0438 URL \u043e\u0434\u0433\u043e\u0432\u0430\u0440\u0430 (\u0438 \u043a\u043e\u043b\u043a\u0443 \u0431\u0440\u0437\u043e)', params: { url: 'string' }, run: async (args) => {
    const url = String(args.url || args.query || '');
    if (!url) throw new Error('url is required');
    try {
      const response = await head(url, { timeout_ms: 12000, retries: 0 });
      return { url, status: response.status, ms: response.ms, reachable: true, server: response.headers.server || null };
    } catch (error) {
      return { url, reachable: false, error: error.message };
    }
  } },
  web_archive: { category: 'web', description: 'Wayback \u0441\u043d\u0438\u043c\u043a\u0430 \u043d\u0430 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430', params: { url: 'string' }, run: async (args) => {
    const url = String(args.url || args.query || '');
    if (!url) throw new Error('url is required');
    const data = await getJson(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, { timeout_ms: 15000 });
    const snapshot = data.archived_snapshots && data.archived_snapshots.closest;
    return { url, archived: Boolean(snapshot), snapshot: snapshot ? { at: snapshot.timestamp, url: snapshot.url, status: snapshot.status } : null };
  } },
  page_speed: { category: 'web', description: '\u0418\u0437\u043c\u0435\u0440\u0438 \u0431\u0440\u0437\u0438\u043d\u0430 \u043d\u0430 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430 (\u043d\u0430\u0448\u0435 \u043c\u0435\u0440\u0435\u045a\u0435)', params: { url: 'string' }, run: async (args) => {
    const url = String(args.url || args.query || '');
    if (!url) throw new Error('url is required');
    const response = await request(url, { timeout_ms: 25000, retries: 0 });
    return {
      url: response.url, status: response.status, total_ms: response.ms, bytes: Buffer.byteLength(response.text, 'utf8'),
      kb_per_second: Number(((Buffer.byteLength(response.text, 'utf8') / 1024) / (response.ms / 1000)).toFixed(1)),
      content_type: response.headers['content-type'], compression: response.headers['content-encoding'] || 'none',
      note: '\u041c\u0435\u0440\u0435\u043d\u043e \u043e\u0434 \u043b\u043e\u043a\u0430\u043b\u043d\u0430\u0442\u0430 \u043c\u0440\u0435\u0436\u0430, \u043d\u0435 \u043e\u0434 Lighthouse.',
    };
  } },
  page_read: { category: 'web', description: '\u0427\u0438\u0442\u0430\u0458 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u0438 \u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0430', params: { url: 'string' }, run: async (args) => {
    const url = String(args.url || args.query || '');
    if (!url) throw new Error('url is required');
    const response = await getText(url, { timeout_ms: 20000 });
    const text = stripHtml(response.text);
    return { url: response.url, status: response.status, title: extractTitle(response.text), words: text.split(/\s+/).filter(Boolean).length, text: text.slice(0, Number(args.limit) || 4000), links: extractLinks(response.text, response.url).slice(0, 40), forms: extractForms(response.text) };
  } },
  dictionary: { category: 'web', description: '\u0417\u043d\u0430\u0447\u0435\u045a\u0435 \u043d\u0430 \u0437\u0431\u043e\u0440 (\u0431\u0435\u0437 \u043a\u043b\u0443\u0447)', params: { word: 'string' }, run: async (args) => {
    const word = String(args.word || args.query || '').trim();
    if (!word) throw new Error('word is required');
    const data = await getJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeout_ms: 15000 });
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry) throw new Error(`no definition for ${word}`);
    return { word: entry.word, phonetic: entry.phonetic, meanings: (entry.meanings || []).slice(0, 3).map((meaning) => ({ part_of_speech: meaning.partOfSpeech, definitions: (meaning.definitions || []).slice(0, 3).map((definition) => definition.definition), synonyms: (meaning.synonyms || []).slice(0, 6) })) };
  } },
};
module.exports = { tools };
