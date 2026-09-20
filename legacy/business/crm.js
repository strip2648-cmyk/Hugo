'use strict';
const { readJsonlSync, appendJsonlSync } = require('../lib/fsx');
const { uuid } = require('../lib/ids');
const { InputError } = require('../lib/errors');
const config = require('../lib/config').load();
function rows() { return readJsonlSync(config.file.crm); }
function listContacts() { return rows().filter((row) => row.type === 'contact'); }
function events(contactId) { return rows().filter((row) => row.type === 'event' && (!contactId || row.contact_id === contactId)); }
async function addContact(input = {}) {
  if (!input.name) throw new InputError('contact name is required');
  const existing = input.email ? listContacts().find((contact) => contact.email && contact.email === input.email) : null;
  const contact = existing
    ? { ...existing, ...input, updated_at: new Date().toISOString() }
    : { id: input.id || uuid().slice(0, 8), stage: input.stage || 'new', ...input, created_at: new Date().toISOString() };
  appendJsonlSync(config.file.crm, { type: 'contact', ...contact });
  const store = require('../memory/store');
  await store.learn(`\u041a\u043e\u043d\u0442\u0430\u043a\u0442: ${contact.name}${contact.company ? ' (' + contact.company + ')' : ''}${contact.email ? ' ' + contact.email : ''}`, { source: 'crm', tags: ['crm', 'contact'] });
  return { contact, updated: Boolean(existing) };
}
async function addEvent(input = {}) {
  if (!input.contact_id || !input.type) throw new InputError('contact_id and type are required');
  const event = { id: uuid().slice(0, 8), ...input, created_at: new Date().toISOString() };
  appendJsonlSync(config.file.crm, { type: 'event', ...event });
  return event;
}
async function setStage(contactId, stage) {
  const contact = listContacts().find((item) => item.id === contactId);
  if (!contact) throw new InputError('contact not found: ' + contactId);
  if (!config.business.crm_stages.includes(stage)) throw new InputError('unknown stage: ' + stage + ' (' + config.business.crm_stages.join(', ') + ')');
  appendJsonlSync(config.file.crm, { type: 'contact', ...contact, stage, updated_at: new Date().toISOString() });
  return { id: contactId, stage };
}
function pipeline() {
  const contacts = listContacts();
  const byStage = {};
  for (const stage of config.business.crm_stages) byStage[stage] = contacts.filter((contact) => (contact.stage || 'new') === stage).length;
  return { total: contacts.length, by_stage: byStage, events: events().length };
}
function actions() {
  return [
    { name: 'crm_add_contact', category: 'business', description: '\u0414\u043e\u0434\u0430\u0458 \u043a\u043e\u043d\u0442\u0430\u043a\u0442', params: { name: 'string', email: 'string' }, handler: async (input) => addContact(input) },
    { name: 'crm_list_contacts', category: 'business', description: '\u041b\u0438\u0441\u0442\u0430 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0438', params: {}, handler: async () => listContacts() },
    { name: 'crm_add_event', category: 'business', description: '\u0414\u043e\u0434\u0430\u0458 \u043d\u0430\u0441\u0442\u0430\u043d', params: { contact_id: 'string', type: 'string' }, handler: async (input) => addEvent(input) },
    { name: 'crm_set_stage', category: 'business', description: '\u041f\u0440\u043e\u043c\u0435\u043d\u0438 \u0444\u0430\u0437\u0430 \u043d\u0430 \u043a\u043e\u043d\u0442\u0430\u043a\u0442', params: { id: 'string', stage: 'string' }, handler: async (input) => setStage(input.id, input.stage) },
    { name: 'crm_pipeline', category: 'business', description: '\u0421\u043e\u0441\u0442\u043e\u0458\u0431\u0430 \u043d\u0430 \u0444\u0430\u0437\u0438\u0442\u0435', params: {}, handler: async () => pipeline() },
  ];
}
module.exports = { addContact, listContacts, addEvent, events, setStage, pipeline, actions };
