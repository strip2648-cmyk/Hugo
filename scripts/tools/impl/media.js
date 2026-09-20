'use strict';
const { getJson } = require('../../lib/http');
const tools = {
  youtube_info: { category: 'media', description: '\u0418\u043d\u0444\u043e \u0437\u0430 YouTube \u0432\u0438\u0434\u0435\u043e (\u0431\u0435\u0437 \u043a\u043b\u0443\u0447)', params: { url: 'string' }, run: async (args) => {
    const url = String(args.url || args.query || '');
    if (!url) throw new Error('url is required');
    const data = await getJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { timeout_ms: 15000 });
    return { title: data.title, author: data.author_name, channel_url: data.author_url, thumbnail: data.thumbnail_url, provider: 'youtube' };
  } },
  youtube_search: { category: 'media', status: 'browser', description: 'YouTube \u043f\u0440\u0435\u0431\u0430\u0440\u0443\u0432\u0430\u045a\u0435 \u043f\u0440\u0435\u043a\u0443 \u0442\u0432\u043e\u0458\u043e\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 (YouTube \u043d\u0435 \u0434\u0430\u0432\u0430 \u043a\u043b\u0443\u0447\u043b\u0435\u0441 \u043f\u0440\u0435\u0431\u0430\u0440\u0443\u0432\u0430\u045a\u0435)', params: { query: 'string' }, run: async (args) => {
    const eyes = require('../../eyes/actions');
    return eyes.run('browser_search', { query: `${args.query || args.text} youtube`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query || args.text || '')}`, extract: 'youtube' });
  } },
  reddit_hot: { category: 'media', description: 'Reddit \u0442\u043e\u043f \u043f\u043e\u0441\u0442\u043e\u0432\u0438 (\u0431\u0435\u0437 \u043a\u043b\u0443\u0447)', params: { subreddit: 'string', limit: 'number' }, run: async (args) => {
    const subreddit = String(args.subreddit || args.query || 'macedonia').replace(/^r\//, '');
    const limit = Math.min(Number(args.limit) || 10, 25);
    try {
      const data = await getJson(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/hot.json?limit=${limit}`, { ua: 'browser', timeout_ms: 15000 });
      const children = (data.data && data.data.children) || [];
      return { subreddit, items: children.map((child) => ({ title: child.data.title, url: `https://reddit.com${child.data.permalink}`, score: child.data.score, comments: child.data.num_comments, author: child.data.author })) };
    } catch (error) {
      const eyes = require('../../eyes/actions');
      if (!/blocked|403|429/i.test(error.message)) throw error;
      return { subreddit, via: 'browser', result: await eyes.run('browser_read', { url: `https://old.reddit.com/r/${subreddit}/hot/`, limit: 3000 }) };
    }
  } },
  podcast_search: { category: 'media', description: '\u041f\u0440\u0435\u0431\u0430\u0440\u0430\u0458 \u043f\u043e\u0434\u043a\u0430\u0441\u0442\u0438 (\u0431\u0435\u0437 \u043a\u043b\u0443\u0447)', params: { query: 'string' }, run: async (args) => {
    const query = String(args.query || args.text || '').trim();
    if (!query) throw new Error('query is required');
    const data = await getJson(`https://itunes.apple.com/search?media=podcast&limit=10&term=${encodeURIComponent(query)}`, { timeout_ms: 15000 });
    return { query, results: (data.results || []).map((item) => ({ name: item.collectionName, author: item.artistName, episodes: item.trackCount, feed: item.feedUrl, url: item.collectionViewUrl })) };
  } },
  movie_search: { category: 'media', description: '\u041f\u0440\u0435\u0431\u0430\u0440\u0430\u0458 \u0444\u0438\u043b\u043c/\u0441\u0435\u0440\u0438\u0458\u0430 (\u0412\u0438\u043a\u0438\u043f\u0435\u0434\u0438\u0458\u0430)', params: { query: 'string' }, run: async (args) => {
    const query = String(args.query || args.text || '').trim();
    if (!query) throw new Error('query is required');
    const data = await getJson(`https://itunes.apple.com/search?media=movie&limit=10&term=${encodeURIComponent(query)}`, { timeout_ms: 15000 });
    const results = (data.results || []).map((item) => ({ title: item.trackName, year: String(item.releaseDate || '').slice(0, 4), genre: item.primaryGenreName, director: item.artistName, summary: item.longDescription, rating: item.contentAdvisoryRating, url: item.trackViewUrl }));
    if (!results.length) return { query, results: [], note: '\u041d\u0435\u043c\u0430 \u0440\u0435\u0437\u0443\u043b\u0442\u0430\u0442\u0438 \u043e\u0434 iTunes; \u043f\u0440\u043e\u0431\u0430\u0458 \u043f\u0440\u0435\u043a\u0443 browser_search' };
    return { query, results };
  } },
  image_search: { category: 'media', status: 'browser', description: '\u041f\u0440\u0435\u0431\u0430\u0440\u0430\u0458 \u0441\u043b\u0438\u043a\u0438 \u043f\u0440\u0435\u043a\u0443 \u0442\u0432\u043e\u0458\u043e\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440', params: { query: 'string' }, run: async (args) => {
    const eyes = require('../../eyes/actions');
    return eyes.run('browser_search', { url: `https://duckduckgo.com/?q=${encodeURIComponent(args.query || '')}&iax=images&ia=images`, query: args.query });
  } },
};
module.exports = { tools };
