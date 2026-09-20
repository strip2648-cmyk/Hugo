'use strict';
const config = require('../lib/config').load();
const { parse, wake } = require('../cognition/commands');
const { InputError } = require('../lib/errors');
const { truncate } = require('../lib/textutil');
function wakeWord(text) { return wake(text); }
function languages() { return config.voice.languages; }
function isBrowserReady() { try { return require('../eyes/chrome').detect().reachable; } catch { return false; } }
async function speak(text, options = {}) {
  const message = String(text || '').trim();
  if (!message) throw new InputError('text is required');
  if (!isBrowserReady()) {
    try {
      const local = require('../host/host').say(message, options);
      if (local.ok) return { ...local, via: 'local-tts', fallback: 'Chrome не е поврзан, користен е локалниот говор' };
      return { spoken: false, reason: local.note || 'нема локален говор', text: message, hint: 'npm run chrome → говор преку твојот Chrome' };
    } catch (error) { return { spoken: false, reason: error.message, text: message }; }
  }
  const language = options.language || config.voice.default_language;
  const expression = '(() => { const utterance = new SpeechSynthesisUtterance(' + JSON.stringify(message.slice(0, 600)) + '); utterance.lang = ' + JSON.stringify(language) + '; speechSynthesis.speak(utterance); return true; })()';
  const result = await require('../eyes/chrome').evaluate(expression, { await_promise: false });
  return { spoken: Boolean(result.value), language, characters: message.length };
}
function listenInstructions() {
  return {
    mode: 'browser-web-speech',
    languages: config.voice.languages,
    wake_words: config.voice.wake_words,
    how: 'npm run ui \u2192 \u043e\u0442\u0432\u043e\u0440\u0438 http://127.0.0.1:' + config.ui.port + ' \u2192 \u043a\u043b\u0438\u043a\u043d\u0438 \u201e\u0421\u043b\u0443\u0448\u0430\u0458\u201c. \u0422\u0432\u043e\u0458\u043e\u0442 Chrome \u0433\u043e \u043f\u0440\u0430\u0432\u0438 \u0442\u043e\u0430 \u0431\u0435\u0437 \u043a\u043b\u0443\u0447.',
    continuous: config.voice.continuous,
  };
}
async function transcript(text, options = {}) {
  const woken = wakeWord(text);
  const command = parse(woken.woken && woken.command ? woken.command : text);
  const runtime = require('../core/runtime');
  if (command.intent === 'chat') {
    const result = await runtime.chat(String(text || ''), options);
    const speech = await speak(result.reply, options).catch((error) => ({ spoken: false, error: error.message }));
    return { heard: truncate(String(text || ''), 200), wake_word: woken.woken ? woken.word : null, command, reply: result.reply, speech };
  }
  const execution = await runtime.run(command.action, command.args, options);
  const reply = execution.ok ? '\u0418\u0437\u0432\u0440\u0448\u0435\u043d\u043e: ' + command.intent + '.' : '\u041d\u0435 \u0443\u0441\u043f\u0435\u0430: ' + execution.error.message;
  const speech = await speak(reply, options).catch((error) => ({ spoken: false, error: error.message }));
  return { heard: truncate(String(text || ''), 200), wake_word: woken.woken ? woken.word : null, command, result: execution.result, reply, speech };
}
async function run(action, args = {}) {
  if (action === 'voice_transcript') return transcript(args.text, args);
  if (action === 'voice_speak') return speak(args.text, args);
  if (action === 'voice_listen') return listenInstructions();
  if (action === 'voice_wake') return wakeWord(args.text || '');
  if (action === 'voice_languages') return { languages: languages(), default: config.voice.default_language, wake_words: config.voice.wake_words };
  throw new InputError('unknown voice action: ' + action);
}
function actions() {
  return [
    { name: 'voice_transcript', category: 'voice', description: '\u041f\u0440\u0435\u0442\u0432\u043e\u0440\u0438 \u0433\u043e\u0432\u043e\u0440 \u0432\u043e \u043a\u043e\u043c\u0430\u043d\u0434\u0430 \u0438 \u0438\u0437\u0432\u0440\u0448\u0438 \u0458\u0430', params: { text: 'string' }, handler: async (input) => run('voice_transcript', input) },
    { name: 'voice_speak', category: 'voice', description: '\u041a\u0430\u0436\u0438 \u0433\u043e \u0442\u0435\u043a\u0441\u0442\u043e\u0442 \u043d\u0430 \u0433\u043b\u0430\u0441 (\u043f\u0440\u0435\u043a\u0443 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u043e\u0442)', params: { text: 'string', language: 'string' }, handler: async (input) => run('voice_speak', input) },
    { name: 'voice_listen', category: 'voice', description: '\u041a\u0430\u043a\u043e \u0434\u0430 \u0433\u043e \u0430\u043a\u0442\u0438\u0432\u0438\u0440\u0430\u0448 \u0441\u043b\u0443\u0448\u0430\u045a\u0435\u0442\u043e', params: {}, handler: async () => run('voice_listen', {}) },
    { name: 'voice_wake', category: 'voice', description: '\u041f\u0440\u043e\u0432\u0435\u0440\u0438 wake-word', params: { text: 'string' }, handler: async (input) => run('voice_wake', input) },
    { name: 'voice_languages', category: 'voice', description: '\u0408\u0430\u0437\u0438\u0446\u0438 \u0437\u0430 \u0433\u043e\u0432\u043e\u0440', params: {}, handler: async () => run('voice_languages', {}) },
  ];
}
module.exports = { speak, transcript, wakeWord, listenInstructions, languages, run, actions, speakLocal: async (text, options = {}) => require('../host/host').say(text, options), stt: () => ({ engine: 'browser-web-speech', languages: config.voice.languages, wake_words: config.voice.wake_words, how: 'npm run start → UI → „Слушај“; твојот Chrome го прави тоа без клуч' }) };
