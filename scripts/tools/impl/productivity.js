'use strict';
const { readJsonSync, writeJsonSync, readJsonlSync, appendJsonlSync } = require('../../lib/fsx');
const { uuid } = require('../../lib/ids');
const { InputError } = require('../../lib/errors');
const config = require('../../lib/config').load();
function todoStore() {
  const data = readJsonSync(config.file.todos, { items: [] });
  if (Array.isArray(data)) return { items: data };
  if (Array.isArray(data.items)) return data;
  if (Array.isArray(data.todos)) return { items: data.todos };
  return { items: [] };
}
function saveTodos(data) { return writeJsonSync(config.file.todos, data); }
function streak(dates) {
  const set = new Set(dates || []);
  let total = 0;
  const cursor = new Date();
  for (let index = 0; index < 400; index += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (set.has(key)) total += 1;
    else if (index > 0) break;
    cursor.setDate(cursor.getDate() - 1);
  }
  return total;
}
const tools = {
  todo: { category: 'productivity', description: '\u041b\u0438\u0441\u0442\u0430 \u043d\u0430 \u0437\u0430\u0434\u0430\u0447\u0438 (\u043b\u043e\u043a\u0430\u043b\u043d\u043e)', params: { action: 'add|list|done|remove|clear', text: 'string', due_at: 'string' }, run: async (args) => {
    const store = todoStore();
    const action = String(args.action || (args.text ? 'add' : 'list'));
    if (action === 'add') {
      if (!args.text) throw new InputError('text is required');
      const item = { id: uuid().slice(0, 8), text: String(args.text).trim(), done: false, due_at: args.due_at || null, created_at: new Date().toISOString() };
      store.items.push(item); saveTodos(store);
      return { added: item, open: store.items.filter((entry) => !entry.done).length };
    }
    if (action === 'done') {
      const item = store.items.find((entry) => entry.id === args.id || entry.text === args.text);
      if (!item) throw new InputError('task not found');
      item.done = true; item.done_at = new Date().toISOString(); saveTodos(store);
      return { done: item, open: store.items.filter((entry) => !entry.done).length };
    }
    if (action === 'remove') { const before = store.items.length; store.items = store.items.filter((entry) => entry.id !== args.id && entry.text !== args.text); saveTodos(store); return { removed: before - store.items.length }; }
    if (action === 'clear') { saveTodos({ items: [] }); return { cleared: store.items.length }; }
    return { open: store.items.filter((entry) => !entry.done), closed: store.items.filter((entry) => entry.done).length };
  } },
  note: { category: 'productivity', description: '\u0411\u0435\u043b\u0435\u0448\u043a\u0438', params: { action: 'save|get|list|remove', title: 'string', text: 'string' }, run: async (args) => {
    const store = readJsonSync(config.file.notes, { notes: {} });
    const notes = store.notes || {};
    const action = String(args.action || (args.text ? 'save' : 'list'));
    const title = String(args.title || (args.text ? String(args.text).slice(0, 40) : 'untitled')).trim();
    if (action === 'save') {
      if (!args.text) throw new InputError('text is required');
      notes[title] = { text: String(args.text), updated_at: new Date().toISOString() };
      writeJsonSync(config.file.notes, { notes });
      return { saved: title, total: Object.keys(notes).length };
    }
    if (action === 'get') { if (!notes[title]) throw new InputError('note not found: ' + title); return { title, ...notes[title] }; }
    if (action === 'remove') { delete notes[title]; writeJsonSync(config.file.notes, { notes }); return { removed: title }; }
    return { notes: Object.entries(notes).map(([name, value]) => ({ title: name, updated_at: value.updated_at, preview: String(value.text).slice(0, 80) })) };
  } },
  reminder_add: { category: 'productivity', description: '\u041f\u043e\u0442\u0441\u0435\u0442\u043d\u0438\u043a', params: { text: 'string', due_at: 'ISO' }, run: async (args) => {
    if (!args.text) throw new InputError('text is required');
    const store = todoStore();
    const item = { id: uuid().slice(0, 8), text: String(args.text).trim(), done: false, due_at: args.due_at || null, reminder: true, created_at: new Date().toISOString() };
    store.items.push(item); saveTodos(store);
    return { reminder: item };
  } },
  pomodoro: { category: 'productivity', description: 'Pomodoro \u0442\u0430\u0458\u043c\u0435\u0440', params: { action: 'start|status|stop', minutes: 'number' }, run: async (args) => {
    const store = readJsonSync(config.file.state, {});
    const action = String(args.action || 'start');
    if (action === 'start') {
      const minutes = Math.min(Math.max(Number(args.minutes) || 25, 1), 180);
      store.pomodoro = { started_at: new Date().toISOString(), ends_at: new Date(Date.now() + minutes * 60000).toISOString(), minutes };
      writeJsonSync(config.file.state, store);
      return { started: true, minutes, ends_at: store.pomodoro.ends_at };
    }
    if (action === 'stop') { delete store.pomodoro; writeJsonSync(config.file.state, store); return { stopped: true }; }
    if (!store.pomodoro) return { running: false };
    return { running: Date.parse(store.pomodoro.ends_at) > Date.now(), remaining_seconds: Math.max(0, Math.round((Date.parse(store.pomodoro.ends_at) - Date.now()) / 1000)) };
  } },
  habit: { category: 'productivity', description: '\u041d\u0430\u0432\u0438\u043a\u0438 \u0438 \u0441\u0435\u0440\u0438\u0438', params: { action: 'check|list', name: 'string' }, run: async (args) => {
    const store = readJsonSync(config.file.habits, { habits: [] });
    const habits = Array.isArray(store.habits) ? store.habits : [];
    const action = String(args.action || (args.name ? 'check' : 'list'));
    if (action === 'check') {
      if (!args.name) throw new InputError('name is required');
      const today = new Date().toISOString().slice(0, 10);
      let habit = habits.find((entry) => entry.name === args.name);
      if (!habit) { habit = { name: args.name, checks: [] }; habits.push(habit); }
      if (!habit.checks.includes(today)) habit.checks.push(today);
      writeJsonSync(config.file.habits, { habits });
      return { habit: habit.name, today, streak: streak(habit.checks), total: habit.checks.length };
    }
    return { habits: habits.map((habit) => ({ name: habit.name, streak: streak(habit.checks), total: habit.checks.length })) };
  } },
  journal: { category: 'productivity', description: '\u0414\u043d\u0435\u0432\u043d\u0438\u043a', params: { action: 'write|read', text: 'string' }, run: async (args) => {
    const action = String(args.action || (args.text ? 'write' : 'read'));
    if (action === 'write') {
      if (!args.text) throw new InputError('text is required');
      const entry = { at: new Date().toISOString(), date: new Date().toISOString().slice(0, 10), text: String(args.text) };
      appendJsonlSync(config.file.journal, entry);
      return { written: entry };
    }
    return { entries: readJsonlSync(config.file.journal, Number(args.limit) || 20) };
  } },
  kanban: { category: 'productivity', description: '\u041a\u0430\u043d\u0431\u0430\u043d', params: { action: 'add|move|list', text: 'string', column: 'string', id: 'string' }, run: async (args) => {
    const store = readJsonSync(config.file.state, {});
    const board = store.kanban || { todo: [], doing: [], done: [] };
    const action = String(args.action || 'list');
    if (action === 'add') {
      if (!args.text) throw new InputError('text is required');
      const column = args.column && board[args.column] ? args.column : 'todo';
      const card = { id: uuid().slice(0, 8), text: String(args.text) };
      board[column].push(card); store.kanban = board; writeJsonSync(config.file.state, store);
      return { added: card, column };
    }
    if (action === 'move') {
      const target = args.column && board[args.column] ? args.column : 'done';
      for (const column of Object.keys(board)) {
        const index = board[column].findIndex((card) => card.id === args.id);
        if (index >= 0) { const [card] = board[column].splice(index, 1); board[target].push(card); store.kanban = board; writeJsonSync(config.file.state, store); return { moved: card, to: target }; }
      }
      throw new InputError('card not found');
    }
    store.kanban = board; writeJsonSync(config.file.state, store);
    return { board };
  } },
  mood_tracker: { category: 'productivity', description: '\u0421\u043b\u0435\u0434\u0435\u045a\u0435 \u043d\u0430 \u0440\u0430\u0441\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435', params: { score: '1-5', note: 'string' }, run: async (args) => {
    const score = Number(args.score);
    if (!Number.isFinite(score) || score < 1 || score > 5) throw new InputError('score 1-5 is required');
    const entry = { at: new Date().toISOString(), score, note: args.note || null };
    appendJsonlSync(config.file.journal, { type: 'mood', ...entry });
    const rows = readJsonlSync(config.file.journal).filter((row) => row.type === 'mood');
    return { logged: entry, average: Number((rows.reduce((total, row) => total + row.score, 0) / rows.length).toFixed(2)), entries: rows.length };
  } },
};
module.exports = { tools, computeStreak: streak };
