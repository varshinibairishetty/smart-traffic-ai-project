// backend/services/weatherService.js
//
// Live Weather Integration Service for Smart Traffic Management System.
// Fetches real-time meteorological observations for Hyderabad locations.
//
// Provider Architecture:
//   • Primary: Open-Meteo REST API (Zero-cost, no API key required, reliable global models)
//   • Secondary: OpenWeatherMap (activated if OPENWEATHER_API_KEY is configured in .env)
//
// Features:
//   • In-memory caching with 15-minute TTL to respect quotas and prevent rate-limiting
//   • Explicit data freshness indicators ('live', 'cached', 'stale', 'unavailable')
//   • Normalized attributes: temperature (°C), humidity (%), precipitation (mm), visibility (m), wind (km/h)

const path = require('path');
// Ensure environment variables are loaded regardless of process working directory
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { HYDERABAD_LOCATIONS } = require('../config/locations');
const logger = require('../utils/logger');

const CACHE_TTL_MS = parseInt(process.env.WEATHER_CACHE_TTL_MS, 10) || 15 * 60 * 1000; // 15 mins default
const REQUEST_TIMEOUT_MS = 5000;

// In-memory cache keyed by location ID
const weatherCache = new Map();

/**
 * Maps WMO standard weather interpretation codes to readable descriptions and icons.
 */
function interpretWeatherCode(code, precipitation = 0) {
  if (code >= 95) {
    return { condition: 'Thunderstorm', icon: '⛈️', category: 'storm' };
  }
  if (code === 65 || code === 82 || precipitation >= 5.0) {
    return { condition: 'Heavy Rain', icon: '🌧️', category: 'rain' };
  }
  if (code === 61 || code === 63 || (code >= 51 && code <= 55) || precipitation > 0) {
    return { condition: code >= 61 ? 'Rain' : 'Drizzle', icon: '🌦️', category: 'rain' };
  }
  if (code === 45 || code === 48) {
    return { condition: 'Fog / Low Visibility', icon: '🌫️', category: 'fog' };
  }
  if (code === 3) {
    return { condition: 'Overcast', icon: '☁️', category: 'cloudy' };
  }
  if (code === 1 || code === 2) {
    return { condition: 'Partly Cloudy', icon: '⛅', category: 'cloudy' };
  }
  return { condition: 'Clear Sky', icon: '☀️', category: 'clear' };
}

/**
 * Fetches live weather for a single coordinate point from Open-Meteo API.
 */
async function fetchFromOpenMeteo(lat, lon, locationId) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,visibility`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Open-Meteo returned HTTP ${res.status}`);
    }
    const data = await res.json();
    const curr = data.current || {};

    const temp = typeof curr.temperature_2m === 'number' ? curr.temperature_2m : 28.0;
    const humidity = typeof curr.relative_humidity_2m === 'number' ? curr.relative_humidity_2m : 50;
    const precip = typeof curr.precipitation === 'number' ? curr.precipitation : 0.0;
    const wind = typeof curr.wind_speed_10m === 'number' ? curr.wind_speed_10m : 10.0;
    const code = typeof curr.weather_code === 'number' ? curr.weather_code : 0;
    const visibility = typeof curr.visibility === 'number' ? curr.visibility : 10000;

    const interpretation = interpretWeatherCode(code, precip);

    return {
      location_id: locationId,
      provider: 'Open-Meteo REST API',
      retrieved_at: new Date().toISOString(),
      data_freshness: 'live',
      conditions: {
        temperature_c: Math.round(temp * 10) / 10,
        relative_humidity_pct: Math.round(humidity),
        precipitation_mm: Math.round(precip * 10) / 10,
        visibility_meters: Math.round(visibility),
        wind_speed_kmh: Math.round(wind * 10) / 10,
        weather_code: code,
        condition_text: interpretation.condition,
        category: interpretation.category,
        icon: interpretation.icon
      }
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches live weather from OpenWeatherMap API if API key is provided.
 */
async function fetchFromOpenWeatherMap(lat, lon, locationId, apiKey) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`OpenWeatherMap returned HTTP ${res.status}`);
    }
    const data = await res.json();

    const main = data.main || {};
    const wind = data.wind || {};
    const weatherList = data.weather || [];
    const firstWeather = weatherList[0] || {};
    const rain = data.rain ? (data.rain['1h'] || 0) : 0;

    return {
      location_id: locationId,
      provider: 'OpenWeatherMap API',
      retrieved_at: new Date().toISOString(),
      data_freshness: 'live',
      conditions: {
        temperature_c: Math.round((main.temp || 28.0) * 10) / 10,
        relative_humidity_pct: Math.round(main.humidity || 50),
        precipitation_mm: Math.round(rain * 10) / 10,
        visibility_meters: data.visibility || 10000,
        wind_speed_kmh: Math.round((wind.speed ? wind.speed * 3.6 : 10.0) * 10) / 10,
        weather_code: firstWeather.id || 800,
        condition_text: firstWeather.main || 'Clear',
        category: firstWeather.main ? firstWeather.main.toLowerCase() : 'clear',
        icon: firstWeather.icon ? `https://openweathermap.org/img/wn/${firstWeather.icon}@2x.png` : '☀️'
      }
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches current weather for a specific location, using cache if still fresh.
 * 
 * @param {Object} location - Location config object
 * @param {boolean} [forceRefresh=false] - Ignore cache TTL
 * @returns {Promise<Object>} Normalized weather payload
 */
async function getLocationWeather(location, forceRefresh = false) {
  const now = Date.now();
  const cached = weatherCache.get(location.id);

  if (!forceRefresh && cached && (now - cached.cached_at) < CACHE_TTL_MS) {
    return {
      ...cached.payload,
      data_freshness: 'cached'
    };
  }

  const openWeatherKey = process.env.OPENWEATHER_API_KEY;

  try {
    let payload;
    if (openWeatherKey && openWeatherKey.trim() !== '') {
      payload = await fetchFromOpenWeatherMap(location.latitude, location.longitude, location.id, openWeatherKey);
    } else {
      payload = await fetchFromOpenMeteo(location.latitude, location.longitude, location.id);
    }

    weatherCache.set(location.id, {
      cached_at: now,
      payload
    });

    return payload;
  } catch (err) {
    logger.debug(`[WeatherService] Fetch failed for ${location.id}: ${err.message}`);

    // Return stale cache if available
    if (cached) {
      return {
        ...cached.payload,
        data_freshness: 'stale',
        warning: `External API call failed (${err.message}). Showing previous observation.`
      };
    }

    // Default transparent unavailable state (no synthetic data fabrication)
    return {
      location_id: location.id,
      provider: openWeatherKey ? 'OpenWeatherMap API' : 'Open-Meteo REST API',
      retrieved_at: new Date().toISOString(),
      data_freshness: 'unavailable',
      error: err.message,
      conditions: {
        temperature_c: null,
        relative_humidity_pct: null,
        precipitation_mm: null,
        visibility_meters: null,
        wind_speed_kmh: null,
        weather_code: null,
        condition_text: 'Data Unavailable',
        category: 'unknown',
        icon: '⚠️'
      }
    };
  }
}

/**
 * Retrieves weather for all configured Hyderabad locations concurrently.
 * 
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Array<Object>>}
 */
async function getAllLocationsWeather(forceRefresh = false) {
  const promises = HYDERABAD_LOCATIONS.map(loc => getLocationWeather(loc, forceRefresh));
  return await Promise.all(promises);
}

module.exports = {
  getLocationWeather,
  getAllLocationsWeather,
  interpretWeatherCode,
  CACHE_TTL_MS
};
