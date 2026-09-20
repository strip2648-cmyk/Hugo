'use strict';
const { getJson } = require('../../lib/http');
function haversine(a, b) {
  const radius = 6371;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Number((2 * radius * Math.asin(Math.sqrt(h))).toFixed(3));
}
const tools = {
  geocode: { category: 'geo', description: '\u0413\u0440\u0430\u0434/\u0430\u0434\u0440\u0435\u0441\u0430 -> \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u0438', params: { query: 'string' }, run: async (args) => {
    const query = String(args.query || args.city || '').trim();
    if (!query) throw new Error('query is required');
    const data = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=${Math.min(Number(args.limit) || 3, 10)}&language=mk&format=json`, { timeout_ms: 15000 });
    return { query, results: (data.results || []).map((hit) => ({ name: hit.name, country: hit.country, admin1: hit.admin1, latitude: hit.latitude, longitude: hit.longitude, timezone: hit.timezone, population: hit.population })) };
  } },
  reverse_geocode: { category: 'geo', description: '\u041a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u0438 -> \u043c\u0435\u0441\u0442\u043e', params: { latitude: 'number', longitude: 'number' }, run: async (args) => {
    if (args.latitude === undefined || args.longitude === undefined) throw new Error('latitude and longitude are required');
    const data = await getJson(`https://nominatim.openstreetmap.org/reverse?lat=${Number(args.latitude)}&lon=${Number(args.longitude)}&format=json&accept-language=mk`, { ua: 'browser', timeout_ms: 15000 });
    return { address: data.display_name, details: data.address, latitude: Number(args.latitude), longitude: Number(args.longitude) };
  } },
  ip_location: { category: 'geo', description: '\u041b\u043e\u043a\u0430\u0446\u0438\u0458\u0430 \u043d\u0430 IP', params: { ip: 'string (optional)' }, run: async (args) => {
    const target = args.ip ? `${encodeURIComponent(args.ip)}/json/` : 'json/';
    const data = await getJson(`https://ipapi.co/${target}`, { timeout_ms: 15000 });
    return { ip: data.ip, city: data.city, region: data.region, country: data.country_name, latitude: data.latitude, longitude: data.longitude, timezone: data.timezone, organization: data.org, source: 'ipapi.co' };
  } },
  timezone: { category: 'geo', description: '\u0412\u0440\u0435\u043c\u0435\u043d\u0441\u043a\u0430 \u0437\u043e\u043d\u0430 \u0437\u0430 \u043b\u043e\u043a\u0430\u0446\u0438\u0458\u0430', params: { city: 'string' }, run: async (args) => {
    const spot = await require('./weather').location(args);
    const now = new Date().toLocaleString('en-GB', { timeZone: spot.timezone, hour12: false });
    return { place: spot.name, timezone: spot.timezone, local_time: now, utc_offset_minutes: await offsetMinutes(spot.timezone) };
  } },
  distance_calc: { category: 'geo', description: '\u0414\u0438\u0441\u0442\u0430\u043d\u0446\u0430 \u043c\u0435\u0453\u0443 \u0434\u0432\u0435 \u0442\u043e\u0447\u043a\u0438 (\u043b\u043e\u043a\u0430\u043b\u043d\u0430 \u043c\u0430\u0442\u0435\u043c\u0430\u0442\u0438\u043a\u0430)', params: { from: '{latitude,longitude}', to: '{latitude,longitude}' }, run: async (args) => {
    const from = args.from || { latitude: args.lat1, longitude: args.lon1 };
    const to = args.to || { latitude: args.lat2, longitude: args.lon2 };
    if (!from || !to || from.latitude === undefined || to.latitude === undefined) throw new Error('from and to coordinates are required');
    return { from, to, kilometers: haversine(from, to), miles: Number((haversine(from, to) * 0.621371).toFixed(3)) };
  } },
  country_info: { category: 'geo', description: '\u0418\u043d\u0444\u043e \u0437\u0430 \u0437\u0435\u043c\u0458\u0430', params: { name: 'string' }, run: async (args) => {
    const name = String(args.name || args.query || 'Macedonia').trim();
    const data = await getJson(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fields=name,capital,population,currencies,languages,timezones,region,area`, { timeout_ms: 15000 });
    const country = Array.isArray(data) ? data[0] : data;
    if (!country) throw new Error(`country not found: ${name}`);
    return { name: country.name && country.name.common, capital: country.capital, population: country.population, currencies: country.currencies, languages: country.languages, timezones: country.timezones, region: country.region, area: country.area };
  } },
};
async function offsetMinutes(timeZone) {
  const now = new Date();
  const local = new Date(now.toLocaleString('en-US', { timeZone }));
  const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  return Math.round((local.getTime() - utc.getTime()) / 60000);
}
module.exports = { tools, haversine, offsetMinutes };
