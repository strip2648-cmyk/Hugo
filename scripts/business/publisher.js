'use strict';
const { InputError } = require('../lib/errors');
const { keywords, truncate } = require('../lib/textutil');
const config = require('../lib/config').load();
async function prepare(input = {}) {
  const headline = String(input.headline || input.name || '').trim();
  if (!headline) throw new InputError('headline is required');
  const brief = String(input.brief || '').trim();
  const terms = keywords(brief, 6).map((item) => item.token);
  const body = [
    headline,
    brief ? brief : '',
    terms.length ? '# ' + terms.slice(0, 3).join(' #') : '',
  ].filter(Boolean).join('\n\n');
  const variants = {
    facebook: truncate(body, 1200),
    instagram: truncate(body, 800),
    linkedin: truncate(headline + '\n\n' + brief + '\n\n\u0410\u043a\u043e \u0432\u0435 \u0438\u043d\u0442\u0435\u0440\u0435\u0441\u0438\u0440\u0430, \u043f\u0438\u0448\u0435\u0442\u0435 \u0432\u043e DM.', 1500),
    email: '\u041d\u0430\u0441\u043b\u043e\u0432: ' + headline + '\n\n' + brief,
  };
  return { headline, body, variants, audience: input.audience || {}, channels: input.channels || ['facebook'], ready: true };
}
async function publish(input = {}) {
  const platform = String(input.platform || 'facebook').toLowerCase();
  const message = String(input.message || '').trim();
  if (!message) throw new InputError('message is required');
  if (config.business.publishing.require_user_confirm && !input.confirm) {
    return { published: false, requires_confirmation: true, platform, preview: truncate(message, 400), note: '\u041f\u043e\u0442\u0432\u0440\u0434\u0438 \u0441\u043e confirm:true \u0437\u0430 \u0434\u0430 \u043e\u0431\u0458\u0430\u0432\u0430\u043c \u043f\u0440\u0435\u043a\u0443 \u0442\u0432\u043e\u0458\u043e\u0442 \u043f\u0440\u043e\u0444\u0438\u043b' };
  }
  const eyes = require('../eyes/actions');
  const text = encodeURIComponent(truncate(message, 900));
  if (platform === 'facebook') {
    const page = await eyes.run('browser_open', { url: 'https://www.facebook.com/' });
    return { published: false, prepared: true, platform, opened: page, text_preview: truncate(message, 300), note: '\u041e\u0442\u0432\u043e\u0440\u0435\u043d \u0435 \u0444\u0435\u0458\u0441\u0431\u0443\u043a \u0432\u043e \u0442\u0432\u043e\u0458\u043e\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u0441\u043e \u0442\u0432\u043e\u0458\u043e\u0442 \u043f\u0440\u043e\u0444\u0438\u043b. \u0417\u0430\u0434\u0430\u0434\u0438 \u0433\u043e \u0442\u0435\u043a\u0441\u0442\u043e\u0442 \u0432\u043e \u043f\u043e\u043b\u0435\u0442\u043e \u0437\u0430 \u043e\u0431\u0458\u0430\u0432\u0430 (browser_type) \u0438 \u043a\u043b\u0438\u043a\u043d\u0438 \u041e\u0431\u0458\u0430\u0432\u0438 \u0441\u0430\u043c.' };
  }
  if (platform === 'instagram') {
    await eyes.run('browser_open', { url: 'https://www.instagram.com/' });
    return { published: false, prepared: true, platform, note: '\u0418\u043d\u0441\u0442\u0430\u0433\u0440\u0430\u043c \u043d\u0435 \u0434\u043e\u0437\u0432\u043e\u043b\u0443\u0432\u0430 \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0441\u043a\u043e \u043e\u0431\u0458\u0430\u0432\u0443\u0432\u0430\u045a\u0435 \u0431\u0435\u0437 \u0430\u043f\u0438; \u0433\u043e \u043e\u0442\u0432\u043e\u0440\u0438\u0432 \u0438 \u0442\u0435\u043a\u0441\u0442\u043e\u0442 \u0435 \u043f\u043e\u0434\u0433\u043e\u0442\u0432\u0435\u043d', text_preview: truncate(message, 300), search_q: text };
  }
  return { published: false, prepared: true, platform, note: '\u041d\u0435\u043f\u043e\u0437\u043d\u0430\u0442\u0430 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0430 \u0435 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u0435\u043d\u0430 \u043a\u0430\u043a\u043e \u0434\u0440\u0430\u0444\u0442', text_preview: truncate(message, 300) };
}
function actions() {
  return [
    { name: 'content_prepare', category: 'business', description: '\u041f\u043e\u0434\u0433\u043e\u0442\u0432\u0438 \u0441\u043e\u0434\u0440\u0436\u0438\u043d\u0430 \u0437\u0430 \u0441\u0438\u0442\u0435 \u043a\u0430\u043d\u0430\u043b\u0438', params: { headline: 'string', brief: 'string' }, handler: async (input) => prepare(input) },
    { name: 'social_publish', category: 'business', description: '\u041e\u0431\u0458\u0430\u0432\u0438 \u043f\u0440\u0435\u043a\u0443 \u0442\u0432\u043e\u0458\u043e\u0442 \u043f\u0440\u043e\u0444\u0438\u043b (\u0431\u0430\u0440\u0430 \u043f\u043e\u0442\u0432\u0440\u0434\u0430)', params: { platform: 'string', message: 'string', confirm: 'boolean' }, safety: 'publish', handler: async (input) => publish(input) },
  ];
}
module.exports = { prepare, publish, actions };
