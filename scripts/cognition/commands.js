'use strict';
const config = require('../lib/config').load();
function clean(text) { return String(text || '').trim().replace(/\s+/g, ' '); }
function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: config.automation.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const out = {};
  for (const part of parts) if (part.type !== 'literal') out[part.type] = Number(part.value);
  return out;
}
function daysFromLocal(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + days);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}
function timezoneOffsetMs(date) {
  const parts = localParts(date);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}
function zonedDateToUtc(parts) {
  const guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second || 0));
  return new Date(guess.getTime() - timezoneOffsetMs(guess));
}
function escaped(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function hasWord(text, words) {
  const pattern = Array.isArray(words) ? words.map(escaped).join('|') : escaped(words);
  return new RegExp('(^|[^\\p{L}\\p{N}_])(?:' + pattern + ')(?=$|[^\\p{L}\\p{N}_])', 'iu').test(String(text || ''));
}
function parseDatePart(text) {
  const now = localParts();
  let date = { year: now.year, month: now.month, day: now.day };
  let matched = false;
  const source = String(text || '').toLowerCase();
  if (hasWord(source, ['денес', 'today'])) matched = true;
  if (hasWord(source, ['задутре', 'day after tomorrow'])) { date = daysFromLocal(date, 2); matched = true; }
  else if (hasWord(source, ['утре', 'tomorrow'])) { date = daysFromLocal(date, 1); matched = true; }
  const explicit = source.match(/\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\b/);
  if (explicit) {
    const day = Number(explicit[1]); const month = Number(explicit[2]);
    let year = explicit[3] ? Number(explicit[3]) : now.year;
    if (year < 100) year += 2000;
    date = { year, month, day };
    const candidate = zonedDateToUtc({ ...date, hour: now.hour, minute: now.minute, second: 0 });
    if (!explicit[3] && candidate.getTime() < Date.now()) date = { year: year + 1, month, day };
    matched = true;
  }
  return { date, matched };
}
function parseTimePart(text, fallbackHour = 9) {
  const source = String(text || '').toLowerCase();
  const clock = source.match(/\b(?:во|at|around)?\s*(\d{1,2})(?::(\d{2}))?\s*(час(?:от|а)?|h|am|pm)?\b/u);
  if (!clock) return { hour: fallbackHour, minute: 0, matched: false };
  let hour = Number(clock[1]);
  const minute = Number(clock[2] || 0);
  const suffix = clock[3] || '';
  if (minute > 59) return { hour: fallbackHour, minute: 0, matched: false };
  if (/pm/u.test(suffix) && hour < 12) hour += 12;
  if (/am/u.test(suffix) && hour === 12) hour = 0;
  if (hour > 23) return { hour: fallbackHour, minute: 0, matched: false };
  return { hour, minute, matched: true };
}
function reminderArgs(text) {
  const source = clean(text);
  const lower = source.toLowerCase();
  const dateInfo = parseDatePart(lower);
  const timeInfo = parseTimePart(lower, 9);
  let due = null;
  if (dateInfo.matched || timeInfo.matched) {
    let date = dateInfo.date;
    if (!dateInfo.matched && timeInfo.matched) {
      const now = localParts();
      const sameDay = zonedDateToUtc({ ...date, hour: timeInfo.hour, minute: timeInfo.minute, second: 0 });
      if (sameDay.getTime() <= Date.now()) date = daysFromLocal(now, 1);
    }
    due = zonedDateToUtc({ ...date, hour: timeInfo.hour, minute: timeInfo.minute, second: 0 }).toISOString();
  }
  let task = source;
  task = task.replace(/(^|[^\p{L}\p{N}_])(?:денес|утре|задутре|today|tomorrow|day after tomorrow)(?=$|[^\p{L}\p{N}_])/giu, '$1');
  task = task.replace(/(^|[^\p{L}\p{N}_])(?:во|at)\s*\d{1,2}(?::\d{2})?\s*(?:час(?:от|а)?|h|am|pm)?(?=$|[^\p{L}\p{N}_])/giu, '$1');
  task = task.replace(/(^|[^\p{L}\p{N}_])\d{1,2}:\d{2}\s*(?:час(?:от|а)?|h|am|pm)?(?=$|[^\p{L}\p{N}_])/giu, '$1');
  task = task.replace(/\s+/g, ' ').replace(/^[,:;\-\s]+|[,:;\-\s]+$/g, '').trim();
  return { text: task || source, due_at: due };
}
const WAKE_WORDS = ['хуго', 'hugo', 'xugo', 'jarvis'];
const PREFIX = '(?:(?:хуго|hugo|xugo|jarvis),?\\s*)?';
const PATTERNS = [
  { intent: 'stop', pattern: new RegExp('^' + PREFIX + '(?:стоп|прекини|stop)$', 'iu') },
  { intent: 'remember', pattern: new RegExp('^' + PREFIX + '(?:запомни|remember)\\s+(.+)$', 'iu'), action: 'remember' },
  { intent: 'recall', pattern: new RegExp('^' + PREFIX + '(?:што\\s+(?:знаеш|памтиш)|what\\s+do\\s+you\\s+know)(?:\\s+(?:за|about))?\\s+(.+)$', 'iu'), action: 'recall' },
  { intent: 'recall', pattern: new RegExp('^' + PREFIX + 'потсети\\s+ме\\s+(?:што\\s+(?:знаеш|памтиш)\\s+)?за\\s+(.+)$', 'iu'), action: 'recall' },
  { intent: 'recall', pattern: new RegExp('^' + PREFIX + 'потсети\\s+ме\\s+за\\s+(?!.*(?:денес|утре|задутре|today|tomorrow|во\\s+\\d|at\\s+\\d))(.*)$', 'iu'), action: 'recall' },
  { intent: 'forget', pattern: new RegExp('^' + PREFIX + '(?:заборави|forget)\\s+(.+)$', 'iu'), action: 'memory_forget_by_text' },
  { intent: 'open', pattern: new RegExp('^' + PREFIX + '(?:отвори|open)\\s+(https?:\\/\\/\\S+)$', 'iu'), action: 'browser_open', arg: 'url' },
  { intent: 'search', pattern: new RegExp('^' + PREFIX + '(?:пребарај|барај|побарај|search|google)\\s+(.+)$', 'iu'), action: 'browser_search', arg: 'query' },
  { intent: 'price', pattern: /(?:цена(?:\s+на)?|price of)\s+(btc|eth|sol|ada|doge|bnb|xrp|bitcoin|ethereum|solana|cardano|dogecoin)/iu, action: 'coin_price', arg: 'coin' },
  { intent: 'weather', pattern: /(?:време(?:\s+во)?|weather in)\s+([\p{L}\s-]{2,40})$/iu, action: 'current_weather', arg: 'city' },
  { intent: 'news', pattern: new RegExp('^' + PREFIX + '(?:вести|новости|news)(?:\\s+(македонија|mk|world|tech))?$', 'iu'), action: 'news_bundle', arg: 'scope' },
  { intent: 'screenshot', pattern: new RegExp('^' + PREFIX + '(?:слика\\s+од\\s+екран|screenshot)(?:\\s+(https?:\\/\\/\\S+))?$', 'iu'), action: 'browser_screenshot', arg: 'url' },
  { intent: 'todo', pattern: new RegExp('^' + PREFIX + '(?:задача|тодо|todo)\\s+(.+)$', 'iu'), action: 'todo' },
  { intent: 'note', pattern: new RegExp('^' + PREFIX + '(?:белешка|note)\\s+(.+)$', 'iu'), action: 'note' },
  { intent: 'remind', pattern: new RegExp('^' + PREFIX + '(?:потсети\\s+ме|потсетник|remind\\s+me)(?:\\s+да|\\s+за|\\s+to)?\\s+(.+)$', 'iu'), action: 'reminder_add' },
  { intent: 'summarize', pattern: new RegExp('^' + PREFIX + '(?:сумирај|summarize)\\s+([\\s\\S]+)$', 'iu'), action: 'summarize' },
  { intent: 'translate', pattern: new RegExp('^' + PREFIX + '(?:преведи|translate)\\s+([\\s\\S]+)$', 'iu'), action: 'translate' },
  { intent: 'help', pattern: new RegExp('^' + PREFIX + '(?:помош|капацитети|help)$', 'iu'), action: 'help' },
];
function parse(command) {
  if (typeof command !== 'string' || !command.trim()) throw new Error('command must be non-empty');
  const normalized = clean(command);
  for (const entry of PATTERNS) {
    const match = normalized.match(entry.pattern);
    if (!match) continue;
    const args = {};
    if (entry.arg && match[1]) args[entry.arg] = match[1].trim();
    else if (match[1]) args.text = match[1].trim();
    if (entry.intent === 'todo') { args.action = 'add'; args.text = (match[1] || '').trim(); }
    if (entry.intent === 'note') { args.action = 'save'; args.text = (match[1] || '').trim(); }
    if (entry.intent === 'remind') Object.assign(args, reminderArgs(match[1] || ''));
    return { intent: entry.intent, action: entry.action || null, args, text: normalized, confidence: 1 };
  }
  return { intent: 'chat', action: null, args: {}, text: normalized, confidence: 0.4 };
}
function wake(text) {
  const source = clean(text);
  const lower = source.toLowerCase();
  for (const word of WAKE_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp('(^|[\\s,!?;:])' + escaped + '(?=$|[\\s,!?;:])', 'iu');
    const match = pattern.exec(lower);
    if (!match) continue;
    const end = match.index + match[0].length;
    const command = source.slice(end).trim().replace(/^[,\s]+/, '');
    return { woken: true, word, command };
  }
  return { woken: false, command: source };
}
module.exports = { parse, wake, PATTERNS, reminderArgs, localParts, zonedDateToUtc };
