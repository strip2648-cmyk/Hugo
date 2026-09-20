'use strict';

const facebook = require('../../sites/facebook');
const youtube = require('../../sites/youtube');
const confirm = require('../../lib/confirm');
const tools = {
  fb_open: { category: 'facebook', description: 'Отвори Facebook во твојот Chrome (со твојата најава)', params: {}, run: async () => facebook.fbOpen() },
  fb_feed_read: { category: 'facebook', description: 'Прочитај го Facebook фидот', params: { limit: 'number' }, run: async (input = {}) => facebook.fbFeedRead(input) },
  fb_write_post: { category: 'facebook', description: 'Напиши Facebook пост (без објавување)', params: { text: 'string' }, run: async (input = {}) => facebook.fbWritePost(input) },
  fb_publish: { category: 'facebook', description: 'Објави го напишаниот пост (со верификација)', params: { text: 'string', confirm: 'boolean' }, run: async (input = {}) => {
    const gate = confirm.ensure('fb_publish', input);
    if (!gate.ok) return { ...gate.gate, reason: 'објавувањето на Facebook бара твоја изрична потврда', preview: input.text || null };
    return facebook.fbPublish(input);
  } },
  fb_search: { category: 'facebook', description: 'Пребарај на Facebook', params: { query: 'string' }, run: async (input = {}) => facebook.fbSearch(input) },
  yt_open: { category: 'youtube', description: 'Отвори YouTube', params: { url: 'string' }, run: async (input = {}) => youtube.ytOpen(input) },
  yt_search: { category: 'youtube', description: 'Пребарај на YouTube', params: { query: 'string' }, run: async (input = {}) => youtube.ytSearch(input) },
  yt_play: { category: 'youtube', description: 'Пушти видео на YouTube', params: { query: 'string', index: 'number' }, run: async (input = {}) => youtube.ytPlay(input) },
  yt_pause: { category: 'youtube', description: 'Паузирај YouTube', params: {}, run: async () => youtube.ytPause() },
  yt_resume: { category: 'youtube', description: 'Продолжи YouTube', params: {}, run: async () => youtube.ytResume() },
  yt_next: { category: 'youtube', description: 'Следно видео', params: {}, run: async () => youtube.ytNext() },
  yt_volume: { category: 'youtube', description: 'Тон на YouTube (0-1)', params: { level: 'number' }, run: async (input = {}) => youtube.ytVolume(input) },
  yt_now_playing: { category: 'youtube', description: 'Што свири сега', params: {}, run: async () => youtube.ytNowPlaying() },
};
module.exports = { tools };
