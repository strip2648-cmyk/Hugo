'use strict';
const crypto = require('node:crypto');
const { InputError } = require('../../lib/errors');
const qr = require('./qr');
const units = {
  km: 1000, m: 1, cm: 0.01, mm: 0.001, mi: 1609.344, ft: 0.3048, in: 0.0254,
  kg: 1, g: 0.001, t: 1000, lb: 0.45359237, oz: 0.028349523125,
  l: 1, ml: 0.001, gal: 3.785411784, c: 1000, f: (value) => (value - 32) / 1.8,
};
const tools = {
  password_gen: { category: 'utils', description: '\u0413\u0435\u043d\u0435\u0440\u0438\u0440\u0430\u0458 \u043b\u043e\u0437\u0438\u043d\u043a\u0430 (\u043b\u043e\u043a\u0430\u043b\u043d\u043e)', params: { length: 'number', symbols: 'boolean' }, run: async (args) => {
    const length = Math.min(Math.max(Number(args.length) || 20, 8), 128);
    const alphabet = `abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789${args.symbols === false ? '' : '!@#$%^&*()-_=+[]{};:,.?'}`;
    let password = '';
    for (let index = 0; index < length; index += 1) password += alphabet[crypto.randomInt(alphabet.length)];
    return { password, length, alphabet_size: alphabet.length, entropy_bits: Number((length * Math.log2(alphabet.length)).toFixed(1)) };
  } },
  uuid_gen: { category: 'utils', description: 'UUID v4', params: { count: 'number' }, run: async (args) => {
    const count = Math.min(Number(args.count) || 1, 50);
    return { uuids: Array.from({ length: count }, () => crypto.randomUUID()) };
  } },
  random_number: { category: 'utils', description: '\u0421\u043b\u0443\u0447\u0430\u0435\u043d \u0431\u0440\u043e\u0458', params: { min: 'number', max: 'number' }, run: async (args) => {
    const min = Number.isFinite(Number(args.min)) ? Number(args.min) : 1;
    const max = Number.isFinite(Number(args.max)) ? Number(args.max) : 100;
    if (max <= min) throw new InputError('max must be greater than min');
    return { min, max, value: crypto.randomInt(Math.floor(min), Math.floor(max) + 1) };
  } },
  coin_flip: { category: 'utils', description: '\u0424\u0440\u043b\u0438 \u043f\u0430\u0440\u0438\u0447\u043a\u0430', params: {}, run: async () => ({ result: crypto.randomInt(2) ? '\u0433\u043b\u0430\u0432\u0430' : '\u043f\u0438\u0441\u043c\u043e' }) },
  dice_roll: { category: 'utils', description: '\u0424\u0440\u043b\u0438 \u043a\u043e\u0446\u043a\u0430', params: { sides: 'number', count: 'number' }, run: async (args) => {
    const sides = Math.max(2, Number(args.sides) || 6);
    const count = Math.min(Math.max(Number(args.count) || 1, 1), 20);
    const rolls = Array.from({ length: count }, () => crypto.randomInt(1, sides + 1));
    return { sides, rolls, total: rolls.reduce((sum, value) => sum + value, 0) };
  } },
  color_convert: { category: 'utils', description: '\u041a\u043e\u043d\u0432\u0435\u0440\u0442\u0438\u0440\u0430\u0458 \u0431\u043e\u0438 (hex/rgb/hsl)', params: { color: 'string' }, run: async (args) => {
    const input = String(args.color || '').trim();
    if (!input) throw new InputError('color is required, e.g. #00e5ff or rgb(0,229,255)');
    let red; let green; let blue;
    if (input.startsWith('#')) {
      const hex = input.slice(1);
      const full = hex.length === 3 ? hex.split('').map((character) => character + character).join('') : hex;
      red = parseInt(full.slice(0, 2), 16); green = parseInt(full.slice(2, 4), 16); blue = parseInt(full.slice(4, 6), 16);
    } else {
      const parts = input.match(/\d+/g) || [];
      [red, green, blue] = parts.map(Number);
    }
    if ([red, green, blue].some((value) => !Number.isFinite(value))) throw new InputError('could not parse color');
    const max = Math.max(red, green, blue) / 255;
    const min = Math.min(red, green, blue) / 255;
    const lightness = (max + min) / 2;
    const saturation = max === min ? 0 : (lightness > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min));
    let hue = 0;
    if (max !== min) {
      if (max === red / 255) hue = ((green - blue) / 255 / (max - min) + (green < blue ? 6 : 0)) / 6;
      else if (max === green / 255) hue = ((blue - red) / 255 / (max - min) + 2) / 6;
      else hue = ((red - green) / 255 / (max - min) + 4) / 6;
    }
    const hex = `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
    return { hex, rgb: `rgb(${red}, ${green}, ${blue})`, hsl: `hsl(${Math.round(hue * 360)}, ${Math.round(saturation * 100)}%, ${Math.round(lightness * 100)}%)`, luminance: Number((0.2126 * red + 0.7152 * green + 0.0722 * blue).toFixed(1)) };
  } },
  unit_convert: { category: 'utils', description: '\u041a\u043e\u043d\u0432\u0435\u0440\u0442\u0438\u0440\u0430\u0458 \u0435\u0434\u0438\u043d\u0438\u0446\u0438', params: { value: 'number', from: 'string', to: 'string' }, run: async (args) => {
    const from = String(args.from || 'km').toLowerCase();
    const to = String(args.to || 'm').toLowerCase();
    const value = Number(args.value);
    if (!Number.isFinite(value)) throw new InputError('value must be a number');
    if (from === 'c' && to === 'f') return { from, to, value, result: Number((value * 1.8 + 32).toFixed(3)) };
    if (from === 'f' && to === 'c') return { from, to, value, result: Number(((value - 32) / 1.8).toFixed(3)) };
    if (!units[from] || !units[to] || typeof units[from] !== 'number' || typeof units[to] !== 'number') throw new InputError(`unsupported units: ${from} -> ${to}`);
    return { from, to, value, result: Number(((value * units[from]) / units[to]).toFixed(6)) };
  } },
  timestamp: { category: 'utils', description: '\u0421\u0435\u0433\u0430\u0448\u0435\u043d \u0442\u0430\u0439\u043c\u0441\u0442\u0430\u043c\u043f \u0432\u043e \u0432\u0438\u0434\u043e\u0432\u0438', params: {}, run: async () => ({ iso: new Date().toISOString(), unix_seconds: Math.floor(Date.now() / 1000), unix_ms: Date.now(), local: new Date().toString() }) },
  date_diff: { category: 'utils', description: '\u0420\u0430\u0437\u043b\u0438\u043a\u0430 \u043c\u0435\u0453\u0443 \u0434\u0430\u0442\u0443\u043c\u0438', params: { from: 'string', to: 'string' }, run: async (args) => {
    const from = Date.parse(args.from || '');
    const to = args.to ? Date.parse(args.to) : Date.now();
    if (!Number.isFinite(from) || !Number.isFinite(to)) throw new InputError('from and to must be valid dates');
    const days = (to - from) / 86400000;
    return { from: new Date(from).toISOString(), to: new Date(to).toISOString(), days: Number(days.toFixed(3)), weeks: Number((days / 7).toFixed(2)), years: Number((days / 365.25).toFixed(2)), business_days: Math.round(days * (5 / 7)) };
  } },
  percent_calc: { category: 'utils', description: '\u041f\u0440\u043e\u0446\u0435\u043d\u0442\u0438', params: { value: 'number', percent: 'number', mode: 'of|change' }, run: async (args) => {
    const value = Number(args.value); const percent = Number(args.percent);
    if (!Number.isFinite(value) || !Number.isFinite(percent)) throw new InputError('value and percent must be numbers');
    if (args.mode === 'change') return { from: value, change_percent: percent, result: Number((value * (1 + percent / 100)).toFixed(4)) };
    return { value, percent, result: Number(((value * percent) / 100).toFixed(4)) };
  } },
  loan_calc: { category: 'utils', description: '\u041a\u0440\u0435\u0434\u0438\u0442: \u0440\u0430\u0442\u0430 \u0438 \u0432\u043a\u0443\u043f\u043d\u043e', params: { amount: 'number', annual_rate_percent: 'number', months: 'number' }, run: async (args) => {
    const amount = Number(args.amount); const rate = Number(args.annual_rate_percent) / 100 / 12; const months = Number(args.months);
    if (![amount, rate, months].every(Number.isFinite) || months <= 0) throw new InputError('amount, annual_rate_percent and months are required');
    const monthly = rate === 0 ? amount / months : (amount * rate) / (1 - (1 + rate) ** -months);
    return { amount, months, monthly_payment: Number(monthly.toFixed(2)), total_paid: Number((monthly * months).toFixed(2)), total_interest: Number((monthly * months - amount).toFixed(2)) };
  } },
  roi_calc: { category: 'utils', description: 'ROI \u0438 \u043f\u043e\u0432\u0440\u0430\u0442', params: { invest: 'number', return_value: 'number', months: 'number' }, run: async (args) => {
    const invest = Number(args.invest); const returned = Number(args.return_value);
    if (!Number.isFinite(invest) || !Number.isFinite(returned) || invest === 0) throw new InputError('invest and return_value are required');
    const roi = ((returned - invest) / invest) * 100;
    const months = Number(args.months);
    return { invest, return_value: returned, profit: Number((returned - invest).toFixed(2)), roi_percent: Number(roi.toFixed(2)), annualized_percent: Number.isFinite(months) && months > 0 ? Number((roi * (12 / months)).toFixed(2)) : null };
  } },
  bmi_calc: { category: 'utils', description: 'BMI', params: { weight_kg: 'number', height_cm: 'number' }, run: async (args) => {
    const weight = Number(args.weight_kg); const height = Number(args.height_cm) / 100;
    if (!Number.isFinite(weight) || !Number.isFinite(height) || height <= 0) throw new InputError('weight_kg and height_cm are required');
    const bmi = weight / (height * height);
    const label = bmi < 18.5 ? '\u043f\u043e\u0442\u0445\u0440\u0430\u043d\u0435\u0442\u043e\u0441\u0442' : bmi < 25 ? '\u043d\u043e\u0440\u043c\u0430\u043b\u043d\u043e' : bmi < 30 ? '\u043f\u0440\u0435\u043a\u0443\u043c\u0435\u0440\u043d\u0430 \u0442\u0435\u0436\u0438\u043d\u0430' : '\u0433\u043e\u043b\u0435\u043c\u0430 \u0442\u0435\u0436\u0438\u043d\u0430';
    return { bmi: Number(bmi.toFixed(1)), label };
  } },
  tip_calc: { category: 'utils', description: '\u0411\u0430\u043a\u0448\u0438\u0448 \u0438 \u043f\u043e\u0434\u0435\u043b\u0431\u0430', params: { bill: 'number', percent: 'number', people: 'number' }, run: async (args) => {
    const bill = Number(args.bill); const percent = Number(args.percent) || 10; const people = Math.max(1, Number(args.people) || 1);
    if (!Number.isFinite(bill)) throw new InputError('bill is required');
    const tip = (bill * percent) / 100;
    return { bill, tip_percent: percent, tip: Number(tip.toFixed(2)), total: Number((bill + tip).toFixed(2)), per_person: Number(((bill + tip) / people).toFixed(2)) };
  } },
  qr_code: { category: 'utils', description: '\u041d\u0430\u043f\u0440\u0430\u0432\u0438 QR \u043a\u043e\u0434 (\u0432\u0438\u0441\u0442\u0438\u043d\u0441\u043a\u0438 \u0435\u043d\u043a\u043e\u0434\u0435\u0440, \u043b\u043e\u043a\u0430\u043b\u043d\u043e)', params: { text: 'string', format: 'text|svg' }, run: async (args) => {
    const text = String(args.text || args.query || '').trim();
    if (!text) throw new InputError('text is required');
    const encoded = qr.encode(text);
    return { text, version: encoded.version, size: encoded.size, mask: encoded.mask, error_correction: 'L', ascii: qr.toText(encoded.matrix), svg: args.format === 'svg' ? qr.toSvg(encoded.matrix) : undefined, note: '\u0412\u0438\u0441\u0442\u0438\u043d\u0441\u043a\u0438 QR (byte mode, ECC L). \u0421\u043a\u0435\u043d\u0438\u0440\u0430\u0458 \u0437\u0430 \u0434\u0430 \u0433\u043e \u0442\u0435\u0441\u0442\u0438\u0440\u0430\u0448.' };
  } },
  qr_svg: { category: 'utils', description: 'QR \u043a\u0430\u043a\u043e SVG', params: { text: 'string' }, run: async (args) => ({ svg: qr.toSvg(qr.encode(String(args.text || args.query || '')).matrix), text: String(args.text || args.query || '') }) },
  password_strength: { category: 'utils', description: '\u0421\u0438\u043b\u0430 \u043d\u0430 \u043b\u043e\u0437\u0438\u043d\u043a\u0430 (\u043b\u043e\u043a\u0430\u043b\u043d\u0430 \u043f\u0440\u043e\u0446\u0435\u043d\u0430)', params: { password: 'string' }, run: async (args) => {
    const password = String(args.password || '');
    if (!password) throw new InputError('password is required');
    let pool = 0;
    if (/[a-z]/.test(password)) pool += 26;
    if (/[A-Z]/.test(password)) pool += 26;
    if (/[0-9]/.test(password)) pool += 10;
    if (/[^a-zA-Z0-9]/.test(password)) pool += 33;
    const entropy = password.length * Math.log2(pool || 1);
    const common = ['password', '123456', 'qwerty', 'admin', 'lozinka'].some((entry) => password.toLowerCase().includes(entry));
    return { length: password.length, entropy_bits: Number(entropy.toFixed(1)), seconds_to_crack_at_10k_per_second: Math.round(2 ** (entropy - 13.3)), common_pattern: common, verdict: common ? '\u043b\u043e\u0448\u0430' : entropy > 80 ? '\u043e\u0434\u043b\u0438\u0447\u043d\u0430' : entropy > 60 ? '\u0434\u043e\u0431\u0440\u0430' : entropy > 40 ? '\u0441\u0440\u0435\u0434\u043d\u0430' : '\u0441\u043b\u0430\u0431\u0430' };
  } },
};
module.exports = { tools };
