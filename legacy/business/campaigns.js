'use strict';
const { readJsonSync, readJsonlSync, appendJsonlSync } = require('../lib/fsx');
const { uuid } = require('../lib/ids');
const { InputError } = require('../lib/errors');
const { truncate, keywords } = require('../lib/textutil');
const config = require('../lib/config').load();
const STORE = config.file.campaigns;
function latest() {
  const map = new Map();
  for (const row of readJsonlSync(STORE)) if (row && row.id) map.set(row.id, row);
  return [...map.values()];
}
function list() { return latest(); }
function get(id) { return latest().find((item) => item.id === id) || null; }
async function create(input = {}) {
  if (!input.name) throw new InputError('campaign name is required');
  const templates = readJsonSync(config.dir.data + '/campaign-templates.json', { templates: [] });
  const template = (templates.templates || []).find((item) => item.id === (input.template_id || 'launch'));
  if (!template) throw new InputError('unknown template: ' + input.template_id);
  const campaign = {
    type: 'campaign', id: 'campaign-' + uuid(),
    name: String(input.name), brief: input.brief || '', audience: input.audience || {},
    channels: input.channels || ['facebook'], template_id: template.id,
    steps: template.steps.map((name) => ({ name, status: 'pending', at: null })),
    status: 'draft', created_at: new Date().toISOString(),
  };
  appendJsonlSync(STORE, campaign);
  const store = require('../memory/store');
  await store.learn(`\u041a\u0430\u043c\u043f\u0430\u045a\u0430 "${campaign.name}": ${truncate(input.brief || '', 200)}`, { source: 'campaign', tags: ['campaign', 'business'] });
  return campaign;
}
async function update(id, changes = {}) {
  const campaign = get(id);
  if (!campaign) throw new InputError('campaign not found: ' + id);
  const next = { ...campaign, ...changes, id, type: 'campaign', updated_at: new Date().toISOString() };
  appendJsonlSync(STORE, next);
  return next;
}
async function execute(input = {}) {
  const campaign = get(input.id);
  if (!campaign) throw new InputError('campaign not found: ' + input.id);
  const content = await require('./publisher').prepare({
    headline: campaign.name, brief: campaign.brief, audience: campaign.audience, channels: campaign.channels,
  });
  const executed = campaign.steps.map((step) => ({
    ...step,
    status: step.name === 'define_audience' || step.name === 'segment' ? 'done' : (step.status === 'done' ? 'done' : 'ready'),
    at: step.status === 'done' ? step.at : new Date().toISOString(),
  }));
  const next = await update(campaign.id, { steps: executed, status: 'ready_to_publish', draft: content });
  return { campaign: next, content, next_actions: ['\u041f\u0440\u0435\u0433\u043b\u0435\u0434\u0430\u0458 \u0433\u043e \u0434\u0440\u0430\u0444\u0442\u043e\u0442', '\u041e\u0431\u0458\u0430\u0432\u0438 \u043f\u0440\u0435\u043a\u0443 \u0442\u0432\u043e\u0458\u043e\u0442 \u043f\u0440\u043e\u0444\u0438\u043b (publish_campaign)'] };
}
async function publish(input = {}) {
  const campaign = get(input.id);
  if (!campaign) throw new InputError('campaign not found: ' + input.id);
  if (!input.confirm && config.business.publishing.require_user_confirm) {
    return {
      published: false,
      requires_confirmation: true,
      draft: campaign.draft || null,
      note: '\u0417\u0430 \u0434\u0430 \u043d\u0435 \u0442\u0438 \u0431\u0430\u043d\u0438\u0440\u0430\u0430\u0442 \u043f\u0440\u043e\u0444\u0438\u043b\u0438\u0442\u0435, \u043f\u043e\u0442\u0432\u0440\u0434\u0438: publish_campaign {id, confirm:true}',
    };
  }
  const result = await require('./publisher').publish({
    platform: (campaign.channels || ['facebook'])[0],
    message: (campaign.draft && campaign.draft.body) || campaign.brief,
    url: input.url,
  });
  await update(campaign.id, { status: result.published ? 'published' : 'publish_failed', publish_result: result });
  return result;
}
function actions() {
  return [
    { name: 'campaign_create', category: 'business', description: '\u041d\u043e\u0432\u0430 \u043a\u0430\u043c\u043f\u0430\u045a\u0430', params: { name: 'string', brief: 'string' }, handler: async (input) => create(input) },
    { name: 'campaign_list', category: 'business', description: '\u041b\u0438\u0441\u0442\u0430 \u043a\u0430\u043c\u043f\u0430\u045a\u0438', params: {}, handler: async () => list().map((campaign) => ({ id: campaign.id, name: campaign.name, status: campaign.status, steps: (campaign.steps || []).length })) },
    { name: 'campaign_execute', category: 'business', description: '\u0418\u0437\u0432\u0440\u0448\u0438 \u0447\u0435\u043a\u043e\u0440\u0438 \u043d\u0430 \u043a\u0430\u043c\u043f\u0430\u045a\u0430 \u0438 \u043f\u043e\u0434\u0433\u043e\u0442\u0432\u0438 \u0434\u0440\u0430\u0444\u0442', params: { id: 'string' }, handler: async (input) => execute(input) },
    { name: 'campaign_update', category: 'business', description: '\u0410\u0436\u0443\u0440\u0438\u0440\u0430\u0458 \u043a\u0430\u043c\u043f\u0430\u045a\u0430', params: { id: 'string', changes: 'object' }, handler: async (input) => update(input.id, input.changes) },
    { name: 'publish_campaign', category: 'business', description: '\u041e\u0431\u0458\u0430\u0432\u0438 \u043a\u0430\u043c\u043f\u0430\u045a\u0430 \u043f\u0440\u0435\u043a\u0443 \u0442\u0432\u043e\u0458\u043e\u0442 \u043f\u0440\u043e\u0444\u0438\u043b (\u0431\u0430\u0440\u0430 \u043f\u043e\u0442\u0432\u0440\u0434\u0430)', params: { id: 'string', confirm: 'boolean' }, safety: 'publish', handler: async (input) => publish(input) },
  ];
}
module.exports = { create, list, get, update, execute, publish, actions };
