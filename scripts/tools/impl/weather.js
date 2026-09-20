'use strict';
const { getJson } = require('../../lib/http');
async function location(args) {
  if (args.latitude !== undefined && args.longitude !== undefined) return { latitude: Number(args.latitude), longitude: Number(args.longitude), name: args.city || 'given coordinates' };
  const city = String(args.city || args.query || 'Skopje').trim();
  const data = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=mk&format=json`, { timeout_ms: 15000 });
  const hit = (data.results || [])[0];
  if (!hit) throw new Error(`city not found: ${city}`);
  return { latitude: hit.latitude, longitude: hit.longitude, name: hit.name, country: hit.country, timezone: hit.timezone, elevation: hit.elevation };
}
function formatCurrent(current, units) {
  if (!current) return null;
  return {
    at: current.time, temperature: current.temperature_2m, feels_like: current.apparent_temperature,
    humidity: current.relative_humidity_2m, wind: current.wind_speed_10m, wind_direction: current.wind_direction_10m,
    precipitation: current.precipitation, is_day: current.is_day === 1, units,
  };
}
const tools = {
  current_weather: { category: 'weather', description: '\u0412\u0440\u0435\u043c\u0435 \u0441\u0435\u0433\u0430 (\u0431\u0435\u0437 \u043a\u043b\u0443\u0447)', params: { city: 'string' }, run: async (args) => {
    const spot = await location(args);
    const data = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${spot.latitude}&longitude=${spot.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,is_day,wind_speed_10m,wind_direction_10m&timezone=auto`, { timeout_ms: 15000 });
    return { place: spot, now: formatCurrent(data.current, data.current_units), source: 'open-meteo' };
  } },
  weather_7day: { category: 'weather', description: '7-\u0434\u043d\u0435\u0432\u043d\u0430 \u043f\u0440\u043e\u0433\u043d\u043e\u0437\u0430', params: { city: 'string' }, run: async (args) => {
    const spot = await location(args);
    const data = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${spot.latitude}&longitude=${spot.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=7`, { timeout_ms: 15000 });
    const daily = data.daily || {};
    const days = (daily.time || []).map((date, index) => ({ date, code: daily.weather_code[index], max: daily.temperature_2m_max[index], min: daily.temperature_2m_min[index], precipitation: daily.precipitation_sum[index], wind_max: daily.wind_speed_10m_max[index] }));
    return { place: spot, days };
  } },
  air_quality: { category: 'weather', description: '\u041a\u0432\u0430\u043b\u0438\u0442\u0435\u0442 \u043d\u0430 \u0432\u043e\u0437\u0434\u0443\u0445\u043e\u0442', params: { city: 'string' }, run: async (args) => {
    const spot = await location(args);
    const data = await getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${spot.latitude}&longitude=${spot.longitude}&current=pm10,pm2_5,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,european_aqi&timezone=auto`, { timeout_ms: 15000 });
    return { place: spot, current: data.current, units: data.current_units };
  } },
  uv_index: { category: 'weather', description: 'UV \u0438\u043d\u0434\u0435\u043a\u0441', params: { city: 'string' }, run: async (args) => {
    const spot = await location(args);
    const data = await getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${spot.latitude}&longitude=${spot.longitude}&current=uv_index,uv_index_clear_sky&timezone=auto`, { timeout_ms: 15000 });
    return { place: spot, uv_index: data.current && data.current.uv_index, clear_sky: data.current && data.current.uv_index_clear_sky };
  } },
  sunrise_sunset: { category: 'weather', description: '\u0418\u0437\u0433\u0440\u0435\u0458\u0443\u0432\u0430\u045a\u0435 \u0438 \u0437\u0430\u043b\u0435\u0437', params: { city: 'string' }, run: async (args) => {
    const spot = await location(args);
    const data = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${spot.latitude}&longitude=${spot.longitude}&daily=sunrise,sunset,daylight_duration&timezone=auto&forecast_days=1`, { timeout_ms: 15000 });
    const daily = data.daily || {};
    return { place: spot, date: (daily.time || [])[0], sunrise: (daily.sunrise || [])[0], sunset: (daily.sunset || [])[0], daylight_seconds: (daily.daylight_duration || [])[0] };
  } },
};
module.exports = { tools, location };
