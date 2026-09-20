'use strict';
const { getJson, getText } = require('../../lib/http');
const { InputError } = require('../../lib/errors');
const JOKES = ['\u0417\u043e\u0448\u0442\u043e \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u0435\u0440\u043e\u0442 \u043d\u0435 \u0438\u0437\u043b\u0435\u0433\u0443\u0432\u0430 \u043d\u0430\u0434\u0432\u043e\u0440? \u0417\u0430\u0442\u043e\u0430 \u0448\u0442\u043e \u045c\u0435 \u043c\u0443 \u0441\u0435 \u0437\u0430\u0433\u043b\u0430\u0432\u0438 \u043a\u043e\u043c\u043f\u0458\u0443\u0442\u0435\u0440\u043e\u0442.', '\u0414\u0432\u0430 \u0431\u0430\u0458\u0442\u0430 \u0441\u0435 \u0448\u0435\u0442\u0430\u0430\u0442. \u0415\u0434\u043d\u0438\u043e\u0442 \u0440\u0435\u0447\u0435: \u041c\u0438\u0441\u043b\u0430\u043c \u0434\u0435\u043a\u0430 \u043d\u0435 \u0431\u0438\u0442\u0438\u043d\u0430\u0432. \u0414\u0440\u0443\u0433\u0438\u043e\u0442: \u0410\u043c\u0430 \u0438 \u0458\u0430\u0441!'];
const RIDDLES = [{ q: '\u0428\u0442\u043e \u043c\u043e\u0436\u0435\u0448 \u0434\u0430 \u0444\u0430\u0442\u0438\u0448, \u0430 \u043d\u0435 \u043c\u043e\u0436\u0435\u0448 \u0434\u0430 \u0433\u043e \u0432\u0438\u0434\u0438\u0448?', a: '\u0412\u0435\u0442\u0435\u0440\u043e\u0442' }, { q: '\u0428\u0442\u043e \u0435 \u043f\u043e\u043b\u043d\u043e \u0434\u0435\u043d\u0435, \u0430 \u0441\u0435\u043a\u043e\u0433\u0430\u0448 \u0435 \u0432\u043a\u043b\u0443\u0447\u0435\u043d\u043e?', a: '\u0421\u0432\u0435\u0442\u043b\u043e\u0442\u043e' }];
const FACTS = ['\u0411\u0430\u043d\u0430\u043d\u0438\u0442\u0435 \u0441\u0435 \u0431\u043e\u0431\u0438\u043b\u043a\u0438, \u043d\u0435 \u043e\u0432\u043e\u0448\u0458\u0435.', '\u041e\u043a\u0442\u043e\u043f\u043e\u0434\u043e\u0442 \u0438\u043c\u0430 \u0442\u0440\u0438 \u0441\u0440\u0446\u0430.', '\u041c\u0435\u0434\u043e\u0442 \u043d\u0438\u043a\u043e\u0433\u0430\u0448 \u043d\u0435 \u0441\u0435 \u0440\u0430\u0441\u0438\u043f\u0430.'];
const FUNCTIONS = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, pow: Math.pow };
function evaluate(expression) {
  const tokens = String(expression).replace(/\s+/g, '').match(/(\d+\.?\d*|[a-z]+|[()+\-*/%^,])/gi);
  if (!tokens || !tokens.length) throw new InputError('expression is required');
  let position = 0;
  const peek = () => tokens[position];
  const parsePrimary = () => {
    const token = peek();
    if (token === '(') { position += 1; const value = parseExpression(); if (peek() !== ')') throw new InputError('missing )'); position += 1; return value; }
    if (token === '-') { position += 1; return -parsePrimary(); }
    if (/^[a-z]+$/i.test(token || '')) {
      const name = String(token).toLowerCase();
      position += 1;
      if (peek() !== '(') throw new InputError(name + ' needs parentheses');
      position += 1;
      const args = [parseExpression()];
      while (peek() === ',') { position += 1; args.push(parseExpression()); }
      if (peek() !== ')') throw new InputError('missing )');
      position += 1;
      if (!FUNCTIONS[name]) throw new InputError('unknown function: ' + name);
      return FUNCTIONS[name](...args);
    }
    position += 1;
    const value = Number(token);
    if (!Number.isFinite(value)) throw new InputError('invalid number: ' + token);
    return value;
  };
  const parsePower = () => { const base = parsePrimary(); if (peek() === '^') { position += 1; return base ** parsePower(); } return base; };
  const parseTerm = () => {
    let value = parsePower();
    while (['*', '/', '%'].includes(peek())) { const operator = peek(); position += 1; const right = parsePower(); value = operator === '*' ? value * right : operator === '/' ? value / right : value % right; }
    return value;
  };
  function parseExpression() {
    let value = parseTerm();
    while (['+', '-'].includes(peek())) { const operator = peek(); position += 1; const right = parseTerm(); value = operator === '+' ? value + right : value - right; }
    return value;
  }
  const result = parseExpression();
  if (position !== tokens.length) throw new InputError('unexpected token: ' + peek());
  return result;
}
const tools = {
  joke: { category: 'fun', description: '\u0428\u0435\u0433\u0430', params: {}, run: async () => {
    try { const data = await getJson('https://official-joke-api.appspot.com/random_joke', { timeout_ms: 8000 }); return { setup: data.setup, punchline: data.punchline, source: 'official-joke-api' }; }
    catch { return { joke: JOKES[Math.floor(Math.random() * JOKES.length)], source: 'local' }; }
  } },
  quote_gen: { category: 'fun', description: '\u0426\u0438\u0442\u0430\u0442', params: {}, run: async () => {
    try { const response = await getText('https://zenquotes.io/api/random', { timeout_ms: 8000 }); const data = JSON.parse(response.text); return { quote: data[0].q, author: data[0].a, source: 'zenquotes' }; }
    catch { return { quote: '\u0421\u0435\u043a\u043e\u0458 \u0434\u0435\u043d \u0435 \u043d\u043e\u0432 \u043f\u043e\u0447\u0435\u0442\u043e\u043a.', author: 'HUGO', source: 'local' }; }
  } },
  riddle: { category: 'fun', description: '\u0413\u0430\u0442\u0430\u043b\u043a\u0430', params: {}, run: async () => ({ ...RIDDLES[Math.floor(Math.random() * RIDDLES.length)], source: 'local' }) },
  trivia: { category: 'fun', description: '\u0422\u0440\u0438\u0432\u0438\u0458\u0430', params: {}, run: async () => {
    try {
      const data = await getJson('https://opentdb.com/api.php?amount=1&type=multiple', { timeout_ms: 8000 });
      const item = data.results && data.results[0];
      if (!item) throw new Error('empty');
      return { question: item.question, correct: item.correct_answer, options: [...item.incorrect_answers, item.correct_answer].sort(), category: item.category, source: 'opentdb' };
    } catch { return { fact: FACTS[Math.floor(Math.random() * FACTS.length)], source: 'local' }; }
  } },
  fact_of_day: { category: 'fun', description: '\u0424\u0430\u043a\u0442 \u043d\u0430 \u0434\u0435\u043d\u043e\u0442', params: {}, run: async () => {
    try { return { fact: (await getText('http://numbersapi.com/random/trivia', { accept: 'text/plain', timeout_ms: 8000 })).text.trim(), source: 'numbersapi' }; }
    catch { return { fact: FACTS[new Date().getDate() % FACTS.length], source: 'local' }; }
  } },
  math_solver: { category: 'fun', description: '\u041a\u0430\u043b\u043a\u0443\u043b\u0430\u0442\u043e\u0440 (\u0431\u0435\u0437\u0431\u0435\u0434\u043d\u043e, \u043b\u043e\u043a\u0430\u043b\u043d\u043e)', params: { expression: 'string' }, run: async (args) => ({ expression: String(args.expression || args.query || ''), result: evaluate(args.expression || args.query || '') }) },
};
module.exports = { tools, evaluate };
