'use strict';
const campaigns = require('./campaigns');
const crm = require('./crm');
const { readJsonlSync } = require('../lib/fsx');
const config = require('../lib/config').load();
function report(options = {}) {
  const campaignList = campaigns.list();
  const contacts = crm.listContacts();
  const events = crm.events();
  const byStage = {};
  for (const stage of config.business.crm_stages) byStage[stage] = contacts.filter((contact) => (contact.stage || 'new') === stage).length;
  const eventTypes = {};
  for (const event of events) eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
  const days = Number(options.days) || 30;
  const cutoff = Date.now() - days * 86400000;
  const recentEvents = events.filter((event) => Date.parse(event.created_at || 0) >= cutoff);
  const won = byStage.won || 0;
  return {
    generated_at: new Date().toISOString(), window_days: days,
    campaigns: { total: campaignList.length, by_status: campaignList.reduce((out, campaign) => { out[campaign.status] = (out[campaign.status] || 0) + 1; return out; }, {}) },
    crm: { contacts: contacts.length, by_stage: byStage, events: events.length, events_in_window: recentEvents.length, by_type: eventTypes, conversion_percent: contacts.length ? Number(((won / contacts.length) * 100).toFixed(1)) : 0 },
    memory: (() => { try { const stats = require('../memory/store').stats(); return { facts: stats.facts, entities: stats.graph.entities }; } catch { return null; } })(),
    conversations: readJsonlSync(config.file.conversations).length,
  };
}
function actions() {
  return [
    { name: 'analytics_report', category: 'business', description: '\u0418\u0437\u0432\u0435\u0448\u0442\u0430\u0458 \u0437\u0430 \u043a\u0430\u043c\u043f\u0430\u045a\u0438 \u0438 CRM', params: { days: 'number' }, handler: async (input) => report(input) },
  ];
}
module.exports = { report, actions };
