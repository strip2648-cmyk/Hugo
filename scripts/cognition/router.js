'use strict';

const { fold } = require('../lib/textutil');
const SEQUENCE = /\s*(?:;|,?\s*(?:а\s+потоа|и\s+потоа|потоа|па\s+потоа|па|и\s+да|then|and\s+then|after\s+that|next)\s+|\.\s+|\n+)\s*/iu;
const RULES = [
  { action: 'fb_publish', re: /^(?:објави(?:\s+го)?(?:\s+постот)?|post\s+it|publish(?:\s+the\s+post)?)$/iu, args: () => ({ confirm: true }), label: 'објави на Facebook' },
  { action: 'fb_write_post', re: /^(?:напиши|write)\s+(?:еден\s+|a\s+)?(?:facebook\s+|фб\s+)?пост(?:\s+на\s+facebook)?[\s:,-]+([\s\S]+)$/iu, args: (m) => ({ text: m[1].trim() }), label: 'напиши Facebook пост' },
  { action: 'fb_write_post', re: /^(?:напиши|write)\s+(?:на\s+)?facebook[\s:,-]+([\s\S]+)$/iu, args: (m) => ({ text: m[1].trim() }), label: 'напиши Facebook пост' },
  { action: 'fb_open', re: /^(?:отвори\s+)?(?:facebook|фб|фејсбук)$/iu, args: () => ({}), label: 'отвори Facebook' },
  { action: 'fb_search', re: /^(?:пребарај|барај|search)\s+на\s+facebook\s+(.+)$/iu, args: (m) => ({ query: m[1] }), label: 'пребарај на Facebook' },
  { action: 'fb_feed_read', re: /^(?:што\s+има\s+ново|прочитај\s+(?:го\s+)?facebook|read\s+facebook)$/iu, args: () => ({}), label: 'прочитај Facebook фид' },
  { action: 'yt_play', re: /^(?:отвори\s+(?:youtube|јутуб)\s+и\s+пушти|open\s+youtube\s+and\s+play)[\s:,-]+([\s\S]+)$/iu, args: (m) => ({ query: m[1].trim() }), label: 'отвори YouTube и пушти' },
  { action: 'yt_play', re: /^(?:пушти|пусти|play)(?:\s+(?:на\s+)?youtube)?[\s:,-]+([\s\S]+)$/iu, args: (m) => ({ query: m[1].trim() }), label: 'пушти на YouTube' },
  { action: 'yt_pause', re: /^(?:паузирај|пауза|pause|стопирај\s+видеото)$/iu, args: () => ({}), label: 'паузирај YouTube' },
  { action: 'yt_resume', re: /^(?:продолжи|resume)$/iu, args: () => ({}), label: 'продолжи YouTube' },
  { action: 'yt_next', re: /^(?:следно\s+видео|next(?:\s+video)?|прескокни)$/iu, args: () => ({}), label: 'следно видео' },
  { action: 'yt_volume', re: /^(?:тон|volume|глас)\s*(?:на\s*youtube)?\s*(?:на|=|:)?\s*(\d{1,3})(?:\s*%)?$/iu, args: (m) => ({ level: Math.max(0, Math.min(100, Number(m[1]))) / 100 }), label: 'тон на YouTube' },
  { action: 'yt_now_playing', re: /^(?:што\s+свири|now\s+playing)$/iu, args: () => ({}), label: 'што свири' },
  { action: 'yt_search', re: /^(?:пребарај|барај|search)\s+на\s+youtube\s+(.+)$/iu, args: (m) => ({ query: m[1] }), label: 'пребарај на YouTube' },
  { action: 'yt_open', re: /^(?:отвори|open)\s+(?:youtube|јутуб)$/iu, args: () => ({}), label: 'отвори YouTube' },
  { action: 'file_write', re: /^(?:направи|создај|креирај|запиши|create|make|write)\s+(?:нов\s+)?(?:фајл\s+|file\s+|датотека\s+)?["']?([^\s"']+\.[A-Za-z0-9]{1,8})["']?(?:\s+(?:со|that\s+says|with|кој\s+содржи|содржина|и\s+содржина)\s+["']?([\s\S]+?)["']?)?$/iu, args: (m) => ({ path: m[1], content: (m[2] === undefined ? '' : m[2].trim()) }), label: 'направи фајл' },
  { action: 'file_append', re: /^(?:додај|append)\s+(?:во\s+)?(?:фајлот\s+)?["']?([^\s"']+)["']?\s+(?:текст\s+)?["']?([\s\S]+)["']?$/iu, args: (m) => ({ path: m[1], content: m[2].trim() }), label: 'додај во фајл' },
  { action: 'file_read', re: /^(?:прочитај|покажи|read|show|cat)\s+(?:го\s+)?(?:фајлот\s+|file\s+)?["']?([^\s"']+\.[A-Za-z0-9]{1,8})["']?$/iu, args: (m) => ({ path: m[1] }), label: 'читај фајл' },
  { action: 'file_delete', re: /^(?:избриши|delete|remove)\s+(?:го\s+)?(?:фајлот\s+|file\s+)?["']?([^\s"']+\.[A-Za-z0-9]{1,8})["']?$/iu, args: (m) => ({ path: m[1] }), label: 'избриши фајл' },
  { action: 'file_mkdir', re: /^(?:направи|create|mkdir)\s+(?:папка|folder|directory)\s+["']?([^\s"']+)["']?$/iu, args: (m) => ({ path: m[1] }), label: 'направи папка' },
  { action: 'file_list', re: /^(?:листај|покажи|list)\s+(?:ги\s+)?(?:фајловите\s+во\s+|files\s+in\s+|папката\s+)?["']?([^\s"']+)["']?$/iu, args: (m) => ({ path: m[1] }), label: 'листа фајлови' },
  { action: 'file_search', re: /^(?:пребарај|најди|search|find)\s+(?:фајл\s+)?["']?([^\s"']+)["']?(?:\s+во\s+(.+))?$/iu, args: (m) => ({ path: (m[2] || '~').trim(), content_pattern: m[1], name_pattern: m[1] }), label: 'пребарај фајлови' },
  { action: 'file_copy', re: /^(?:копирај|copy)\s+["']?([^\s"']+)["']?\s+(?:во|to|->)\s+["']?([^\s"']+)["']?$/iu, args: (m) => ({ from: m[1], to: m[2] }), label: 'копирај' },
  { action: 'file_move', re: /^(?:премести|move)\s+["']?([^\s"']+)["']?\s+(?:во|to|->)\s+["']?([^\s"']+)["']?$/iu, args: (m) => ({ from: m[1], to: m[2] }), label: 'премести' },
  { action: 'ps_run', re: /^(?:powershell|пс)\s*[:>]\s*([\s\S]+)$/iu, args: (m) => ({ script: m[1] }), label: 'PowerShell' },
  { action: 'wsl_run', re: /^wsl\s*[:>]?\s*([\s\S]+)$/iu, args: (m) => ({ command: m[1] }), label: 'WSL команда' },
  { action: 'shell_run', re: /^(?:изврши|run)\s+(?:команда\s+)?[`"']([\s\S]+)[`"']$/iu, args: (m) => ({ command: m[1] }), label: 'изврши команда' },
  { action: 'process_list', re: /^(?:процеси|processes|process\s+list)$/iu, args: () => ({}), label: 'листа процеси' },
  { action: 'app_start', re: /^(?:отвори|стартувај|start|launch)\s+(?:апликација\s+|app\s+)?(notepad|calc|calculator|explorer|cmd|powershell|taskmgr|paint|word|excel)$/iu, args: (m) => ({ name: m[1] }), label: 'стартувај апликација' },
  { action: 'app_open', re: /^(?:отвори|open)\s+(?:папка|folder)\s+(.+)$/iu, args: (m) => ({ target: m[1].trim() }), label: 'отвори папка' },
  { action: 'browser_open', re: /^(?:отвори|open)\s+(https?:\/\/\S+)$/iu, args: (m) => ({ url: m[1] }), label: 'отвори линк' },
  { action: 'browser_search', re: /^(?:пребарај|барај|search|google)\s+(.+)$/iu, args: (m) => ({ query: m[1].trim() }), label: 'пребарај на интернет' },
  { action: 'browser_screenshot', re: /^(?:слика\s+од\s+екран|screenshot)$/iu, args: () => ({}), label: 'слика од екран' },
  { action: 'clip_get', re: /^(?:што\s+има\s+во\s+clipboard|clipboard)$/iu, args: () => ({}), label: 'прочитај clipboard' },
  { action: 'say', re: /^(?:кажи|изговори|say)\s+["']?([\s\S]+?)["']?$/iu, args: (m) => ({ text: m[1].trim() }), label: 'кажи на глас' },
  { action: 'remember', re: /^(?:запомни|remember)\s+(.+)$/iu, args: (m) => ({ text: m[1].trim() }), label: 'запомни' },
  { action: 'recall', re: /^(?:што\s+знаеш\s+за|what\s+do\s+you\s+know\s+about)\s+(.+)$/iu, args: (m) => ({ query: m[1].trim() }), label: 'потсети' },
  { action: 'help', re: /^(?:помош|help|капацитети|што\s+можеш)$/iu, args: () => ({}), label: 'помош' },
];
function clauses(text) { return String(text || '').split(SEQUENCE).map((part) => part.trim()).filter((part) => part.length > 1); }
function routeStep(text) {
  const clean = String(text || '').trim().replace(/^(?:хуго|hugo|xugo|jarvis)[\s,!?:.]+/iu, '');
  for (const rule of RULES) {
    const match = clean.match(rule.re);
    if (!match) continue;
    return { action: rule.action, args: rule.args(match), label: rule.label, score: 1, source: 'router', text: clean };
  }
  const folded = fold(clean);
  for (const rule of RULES) if (folded.includes(fold(rule.label))) return { action: rule.action, args: rule.args([clean, '']), label: rule.label, score: 0.6, source: 'router-fuzzy', text: clean };
  return null;
}
function route(text, options = {}) {
  const parts = options.steps || clauses(text);
  const steps = [];
  for (const part of parts) {
    const hit = routeStep(part);
    if (hit) steps.push({ description: part, kind: 'tool', action: hit.action, args: hit.args, label: hit.label, match_score: hit.score, route_source: hit.source, status: 'pending' });
    else steps.push({ description: part, kind: 'blocked', status: 'pending', reason: 'немам алат што сигурно го прави ова: „' + part + '“' });
  }
  return steps;
}
function isSequence(text) { return clauses(text).length > 1; }
module.exports = { route, routeStep, clauses, isSequence, RULES };
