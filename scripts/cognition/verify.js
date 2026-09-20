'use strict';

const fs = require('node:fs');
const host = require('../host/host');
const { truncate } = require('../lib/textutil');
function fromResult(result) {
  if (!result || typeof result !== 'object') return null;
  if (result.needs_confirmation) return { verified: false, blocked: true, how: 'чека твоја потврда (' + (result.confirmation_id || '') + ')' };
  if (typeof result.verified === 'boolean') return { verified: result.verified, how: result.verified_how || 'самопроверка на алатката' };
  return null;
}
async function verify(action, args = {}, result) {
  const declared = fromResult(result);
  if (declared) return declared;
  switch (String(action || '')) {
    case 'file_write': case 'file_append': {
      try {
        const file = host.assertAllowed(host.resolvePath(args.path));
        if (!fs.existsSync(file)) return { verified: false, how: 'фајлот не постои по запишувањето' };
        const text = fs.readFileSync(file, 'utf8');
        const wanted = String(args.content == null ? '' : args.content);
        const ok = args.mode === 'append' || text === wanted || text.endsWith(wanted);
        return { verified: ok, how: ok ? 'фајлот постои и содржината е прочитана назад' : 'содржината не се совпаѓа' };
      } catch (error) { return { verified: false, how: 'проверката не успеа: ' + error.message }; }
    }
    case 'file_delete': {
      try { const file = host.resolvePath(args.path); return { verified: !fs.existsSync(file), how: fs.existsSync(file) ? 'фајлот сѐ уште постои' : 'фајлот е отстранет' }; }
      catch (error) { return { verified: false, how: error.message }; }
    }
    case 'file_copy': case 'file_move': {
      try { const to = host.resolvePath(args.to || ''); return { verified: fs.existsSync(to), how: fs.existsSync(to) ? 'целта постои' : 'целта не постои' }; }
      catch (error) { return { verified: false, how: error.message }; }
    }
    case 'browser_open': return { verified: Boolean(result && result.url), how: 'страница: ' + truncate(String((result || {}).url || ''), 80) };
    case 'shell_run': case 'ps_run': case 'wsl_run': case 'cmd_run': return { verified: Boolean(result && result.ok), how: result && result.ok ? 'командата заврши успешно' : 'командата врати грешка' };
    default:
      if (result === null || result === undefined) return { verified: false, how: 'нема резултат' };
      if (result.ok === false) return { verified: false, how: 'алатката пријави грешка' };
      return { verified: true, how: 'нема независна проверка (безбедна операција)' };
  }
}
module.exports = { verify, fromResult };
