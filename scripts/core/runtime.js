'use strict';
const { toEnvelope } = require('../lib/errors');
const { shortId } = require('../lib/ids');
const logger = require('../lib/logger').createLogger('runtime');
const conversations = require('../memory/conversations');
function actions() { return require('./actions'); }
function listActions() { return actions().list(); }
async function run(action, input = {}, options = {}) {
  const started = Date.now();
  const entry = actions().find(action);
  if (!entry) {
    return { ok: false, action, error: { code: 'HUGO_NOT_FOUND', message: `unknown action: ${action}`, details: { available: actions().names().slice(0, 60) } }, ms: 0, at: new Date().toISOString() };
  }
  try {
    const result = await entry.handler(input || {}, options);
    if (result && result.ok === false) {
      const error = { code: result.error?.code || 'HUGO_ACTION_FAILED', message: result.error?.message || result.reason || 'action reported failure', details: result };
      if (options.log !== false) conversations.append({ type: 'action_error', role: 'system', text: `${action} failed: ${error.message}`, action, session: options.session });
      return { ok: false, action, category: entry.category, error, result, ms: Date.now() - started, at: new Date().toISOString() };
    }
    if (options.log !== false) conversations.append({ type: 'action', role: 'system', text: `${action} ok`, action, session: options.session });
    return { ok: true, action, category: entry.category, result, ms: Date.now() - started, at: new Date().toISOString() };
  } catch (error) {
    logger.error(`action failed: ${action}`, { message: error.message });
    conversations.append({ type: 'action_error', role: 'system', text: `${action} failed: ${error.message}`, action, session: options.session });
    return { ...toEnvelope(error, action), ms: Date.now() - started, at: new Date().toISOString() };
  }
}
function composeReply(text, analysis, memoryContext) {
  const parts = [];
  if (memoryContext && memoryContext.text) parts.push(memoryContext.text);
  parts.push(analysis.content || analysis.conclusion);
  if (analysis.next_actions && analysis.next_actions.length && analysis.kind !== 'knowledge') parts.push(`\u041c\u043e\u0436\u0430\u043c \u0434\u0430 \u0433\u043e \u0438\u0437\u0432\u0440\u0448\u0430\u043c: ${analysis.next_actions.join(' | ')}`);
  if (analysis.assumptions && analysis.assumptions.length) parts.push(`\u041f\u0440\u0435\u0442\u043f\u043e\u0441\u0442\u0430\u0432\u043a\u0438: ${analysis.assumptions.join(' ')}`);
  return parts.join('\n');
}
function summarizeGoal(result) {
  if (!result) return '\u041d\u0435\u043c\u0430\u043c \u0440\u0435\u0437\u0443\u043b\u0442\u0430\u0442.';
  const lines = (result.observations || []).map((observation) => `${observation.ok ? '\u2713' : '\u2717'} ${observation.description}: ${observation.summary}`);
  const head = result.success ? '\u0417\u0430\u0432\u0440\u0448\u0435\u043d\u043e.' : '\u0417\u0430\u0432\u0440\u0448\u0435\u043d\u043e \u0441\u043e \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u0438.';
  return [head, ...lines, result.replans ? `\u041f\u0440\u0435\u0438\u0441\u043f\u0438\u0442\u0430\u0432 ${result.replans} \u043f\u0430\u0442\u0438.` : ''].filter(Boolean).join('\n');
}
function formatActionReply(actionResult, command) {
  if (!actionResult || !actionResult.ok) return `Не успеа: ${actionResult?.error?.message || actionResult?.result?.reason || 'непозната грешка'}`;
  const data = actionResult.result;
  const intent = command?.intent || actionResult.action || '';
  if (intent === 'remember') {
    const text = data?.fact?.text || data?.text || command?.args?.text || '';
    return text ? `Запаметив: ${text}` : 'Запаметив.';
  }
  if (intent === 'recall') {
    const hits = Array.isArray(data?.hits) ? data.hits : [];
    if (!hits.length) return `Немам запамтено ништо за „${command?.args?.query || command?.args?.text || ''}“.`;
    return ['Го најдов следново:', ...hits.slice(0, 5).map((hit) => `- ${hit.text || hit.content || hit.title || hit.id}`)].join('\n');
  }
  if (intent === 'todo') {
    if (data?.added?.text) return `Додадов задача: ${data.added.text}`;
    if (data?.open && Array.isArray(data.open)) return `Имаш ${data.open.length} отворени задачи.`;
    if (data?.done?.done) return 'Задачата е завршена.';
    if (data?.removed !== undefined) return `Избришав ${data.removed} задача${data.removed === 1 ? '' : 'и'}.`;
  }
  if (intent === 'note') {
    if (data?.text) return `Белешката е зачувана: ${data.text}`;
    if (data?.saved) return `Белешката е зачувана: ${data.saved}`;
    if (data?.title) return `Белешката „${data.title}“ е зачувана.`;
  }
  if (intent === 'remind' || intent === 'reminder_add' || actionResult.action === 'reminder_add') {
    const due = data?.reminder?.due_at;
    if (due) {
      const when = new Intl.DateTimeFormat('mk-MK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Skopje' }).format(new Date(due));
      return `Ќе те потсетам на „${data.reminder.text}“ на ${when}.`;
    }
    return data?.reminder?.text ? `Ќе те потсетам на „${data.reminder.text}“.` : 'Потсетникот е зачуван.';
  }
  if (intent === 'coin_price' || actionResult.action === 'coin_price') {
    if (data?.usd !== undefined) {
      const change = data.change_24h_percent !== undefined ? ` (${Number(data.change_24h_percent).toFixed(2)}% 24ч.)` : '';
      return `${String(data.coin || 'BTC').toUpperCase()}: $${data.usd}${data.eur !== undefined ? ` / €${data.eur}` : ''}${change}`;
    }
  }
  if (intent === 'current_weather' || actionResult.action === 'current_weather') {
    if (data?.temperature !== undefined) {
      const place = data.location || data.city || command?.args?.city || '';
      const feels = data.feels_like !== undefined ? `, чувствува ${data.feels_like}°C` : '';
      return `Времето${place ? ` во ${place}` : ''}: ${data.temperature}°C${feels}.`;
    }
  }
  if (data?.summary) return data.summary;
  if (data?.text && typeof data.text === 'string') return data.text;
  if (data?.message) return String(data.message);
  if (Array.isArray(data)) return data.slice(0, 8).map((x) => typeof x === 'string' ? x : (x.title || x.text || JSON.stringify(x))).join('\n');
  if (data && typeof data === 'object') {
    try {
      const compact = JSON.stringify(data, null, 2);
      return compact.length > 1800 ? compact.slice(0, 1800) + '\n…' : compact;
    } catch {}
  }
  return `Извршено: ${command?.intent || actionResult.action || 'задача'}.`;
}
async function chat(text, options = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('chat needs text');
  const session = options.session || shortId('session');
  conversations.append({ type: 'message', role: 'user', text, session });
  const store = require('../memory/store');
  const memoryContext = store.context(text, { limit: 4 });
  const { parse, wake } = require('../cognition/commands');
  const woken = wake(text);
  const command = parse(woken.woken && woken.command ? woken.command : text);
  let reply = '';
  let actionResult = null;
  let planResult = null;

  if (command.intent === 'help') {
    const report = require('./capabilities').report();
    reply = `\u041c\u043e\u0436\u0430\u043c: ${report.actions.categories.map((entry) => `${entry.category} (${entry.count})`).join(', ')}. \u0421\u0435 \u0432\u043a\u0443\u043f\u043d\u043e ${report.actions.total} \u0430\u043a\u0446\u0438\u0438, \u0430\u043b\u0430\u0442\u043a\u0438: ${report.tools.real} \u0440\u0435\u0430\u043b\u043d\u0438.`;
  } else if (command.intent === 'stop') {
    reply = '\u041f\u0440\u0435\u043a\u0438\u043d\u0430\u0432.';
  } else if (command.action) {
    actionResult = await run(command.action, command.args, { session });
    reply = formatActionReply(actionResult, command);
  } else {
    const { reason, classify, routeWithOllama } = require('../cognition/reasoner');
    const direct = require('../cognition/router').routeStep(text);
    const directEntry = direct && actions().find(direct.action);
    if (directEntry) {
      actionResult = await run(direct.action, direct.args, { session });
      reply = formatActionReply(actionResult, { intent: direct.action, args: direct.args });
    }
    let modelRoute = null;
    let routeFailed = false;
    try { if (!directEntry) modelRoute = await routeWithOllama(text, {}); } catch { routeFailed = true; }
    if (modelRoute) {
      actionResult = await run(modelRoute.tool, modelRoute.params, { session });
      reply = formatActionReply(actionResult, { intent: modelRoute.tool, args: modelRoute.params });
      conversations.append({ type: 'tool_route', role: 'system', text: `${text} -> ${modelRoute.tool}`, route: modelRoute });
    }
    if (directEntry || modelRoute) {
      const ingest = await conversations.ingest({ maxLines: 50 }).catch(() => null);
      conversations.append({ type: 'message', role: 'assistant', text: reply, session });
      return { reply, session, action: directEntry ? direct.action : modelRoute.tool, result: actionResult, plan: null, learned: ingest ? ingest.learned + ingest.updated : 0 };
    }
    const analysis = await reason(text, { memory: memoryContext }, routeFailed ? { local_only: true } : {});
    const kind = classify(text).kind;
    if (options.forceGoal || kind === 'plan' || kind === 'action') {
      planResult = await run('goal', { goal: text }, { session });
      reply = planResult.ok ? summarizeGoal(planResult.result) : `\u041d\u0435 \u0443\u0441\u043f\u0435\u0430 \u043f\u043b\u0430\u043d\u043e\u0442: ${planResult.error.message}`;
    } else {
      reply = composeReply(text, analysis, memoryContext);
    }
  }
  conversations.append({ type: 'message', role: 'assistant', text: reply, session });
  const ingest = await conversations.ingest({ maxLines: 50 }).catch(() => null);
  return { reply, session, action: command.action || (planResult ? 'goal' : null), result: actionResult, plan: planResult, learned: ingest ? ingest.learned + ingest.updated : 0 };
}
async function goal(text, options = {}) {
  const result = await run('goal', { goal: text }, options);
  return result;
}
function status() {
  return require('./capabilities').report();
}
module.exports = { run, chat, goal, status, listActions };
