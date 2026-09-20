'use strict';
const { readJsonSync, writeJsonSync } = require('../lib/fsx');
const { request, } = require('../lib/http');
const { InputError } = require('../lib/errors');
const config = require('../lib/config').load();
function load() { const data = readJsonSync(config.file.mcp, { servers: [], transport: 'http', allow_tools: [] }); return data; }
function save(data) { return writeJsonSync(config.file.mcp, data); }
function list() { return load().servers || []; }
function add(server) {
  if (!server || !server.id) throw new InputError('server needs an id');
  const data = load();
  data.servers = (data.servers || []).filter((entry) => entry.id !== server.id).concat(server);
  save(data);
  return server;
}
async function call(input = {}) {
  const server = list().find((entry) => entry.id === input.server);
  if (!server) throw new InputError('unknown MCP server: ' + input.server);
  if (!server.endpoint) throw new InputError('MCP server ' + input.server + ' has no endpoint (stdio servers need a local bridge)');
  const response = await request(server.endpoint, {
    method: 'POST', retries: 0, timeout_ms: config.tools.timeout_ms,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: input.tool, arguments: input.args || {} } }),
  });
  try { return JSON.parse(response.text); } catch { return { raw: response.text }; }
}
function actions() {
  return [
    { name: 'mcp_list', category: 'integrations', description: 'MCP \u0441\u0435\u0440\u0432\u0435\u0440\u0438', params: {}, handler: async () => list() },
    { name: 'mcp_add', category: 'integrations', description: '\u0414\u043e\u0434\u0430\u0458 MCP \u0441\u0435\u0440\u0432\u0435\u0440', params: { id: 'string', endpoint: 'string' }, handler: async (input) => add(input) },
    { name: 'mcp_call', category: 'integrations', description: '\u041f\u043e\u0432\u0438\u043a\u0430\u0458 MCP \u0430\u043b\u0430\u0442\u043a\u0430', params: { server: 'string', tool: 'string', args: 'object' }, handler: async (input) => call(input) },
  ];
}
module.exports = { list, add, call, actions, load };
