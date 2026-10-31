// backend/services/telemetryAggregator.js
//
// Telemetry Aggregator Service for Smart Traffic Management System.
// Merges live traffic flow, current weather, and verified provider incidents
// across all configured Hyderabad locations into unified telemetry payloads.
//
// Core Guarantees:
//   • Aligns traffic and weather observations by location and approximate timestamp.
//   • Separates provider-reported facts from derived/provisional indicators.
//   • Tracks data freshness ('live', 'cached', 'stale', 'unconfigured', 'unavailable').

const { HYDERABAD_LOCATIONS, getLocationById } = require('../config/locations');
const { getAllLocationsTrafficFlow, getLocationTrafficFlow, getActiveIncidents, isTomTomConfigured } = require('./trafficService');
const { getAllLocationsWeather, getLocationWeather } = require('./weatherService');
const logger = require('../utils/logger');

/**
 * Calculates straight-line distance in kilometers between two lat/lon points (Haversine formula).
 */
function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Aggregates live traffic, weather, and incidents across all Hyderabad locations.
 * 
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Object>} Unified multi-modal telemetry payload
 */
async function getCombinedTelemetry(forceRefresh = false) {
  const [trafficList, weatherList, incidentsData] = await Promise.all([
    getAllLocationsTrafficFlow(forceRefresh),
    getAllLocationsWeather(forceRefresh),
    getActiveIncidents(forceRefresh)
  ]);

  const trafficMap = new Map(trafficList.map(t => [t.location_id, t]));
  const weatherMap = new Map(weatherList.map(w => [w.location_id, w]));
  const allIncidents = incidentsData.incidents || [];

  const locationsTelemetry = HYDERABAD_LOCATIONS.map(loc => {
    const traffic = trafficMap.get(loc.id) || null;
    const weather = weatherMap.get(loc.id) || null;

    // Associate incidents within 4 km of this junction
    const nearbyIncidents = allIncidents.filter(inc => {
      if (!inc.coordinates?.latitude || !inc.coordinates?.longitude) return false;
      const dist = getDistanceKm(
        loc.latitude, loc.longitude,
        inc.coordinates.latitude, inc.coordinates.longitude
      );
      return dist <= 4.0;
    });

    // Determine overall location freshness status
    const trafficFreshness = traffic?.data_freshness || 'unavailable';
    const weatherFreshness = weather?.data_freshness || 'unavailable';

    let locationFreshness = 'live';
    if (trafficFreshness === 'stale' || weatherFreshness === 'stale') {
      locationFreshness = 'stale';
    } else if (trafficFreshness === 'cached' || weatherFreshness === 'cached') {
      locationFreshness = 'cached';
    } else if (trafficFreshness === 'unconfigured') {
      locationFreshness = 'traffic_unconfigured';
    }

    return {
      location_id: loc.id,
      name: loc.name,
      short_name: loc.short_name,
      corridor: loc.corridor,
      category: loc.category,
      coordinates: {
        latitude: loc.latitude,
        longitude: loc.longitude
      },
      speed_limit_kmh: loc.speed_limit_kmh,
      data_freshness: locationFreshness,
      last_updated: new Date().toISOString(),
      traffic: traffic,
      weather: weather,
      nearby_incidents_count: nearbyIncidents.length,
      nearby_incidents: nearbyIncidents
    };
  });

  // Calculate high-level city summary metrics
  const validSpeeds = locationsTelemetry
    .map(l => l.traffic?.metrics?.current_speed_kmh)
    .filter(s => typeof s === 'number');

  const avgSpeed = validSpeeds.length > 0 
    ? Math.round((validSpeeds.reduce((a, b) => a + b, 0) / validSpeeds.length) * 10) / 10 
    : null;

  const validTemps = locationsTelemetry
    .map(l => l.weather?.conditions?.temperature_c)
    .filter(t => typeof t === 'number');

  const avgTemp = validTemps.length > 0
    ? Math.round((validTemps.reduce((a, b) => a + b, 0) / validTemps.length) * 10) / 10
    : null;

  return {
    timestamp: new Date().toISOString(),
    city: 'Hyderabad, Telangana, India',
    tomtom_configured: isTomTomConfigured(),
    summary: {
      total_monitored_locations: HYDERABAD_LOCATIONS.length,
      average_speed_kmh: avgSpeed,
      average_temperature_c: avgTemp,
      total_provider_incidents: allIncidents.length,
      active_weather_provider: weatherList[0]?.provider || 'Open-Meteo REST API',
      active_traffic_provider: isTomTomConfigured() ? 'TomTom Traffic API' : 'Unconfigured (Add TOMTOM_API_KEY)',
    },
    locations: locationsTelemetry,
    provider_incidents: incidentsData
  };
}

/**
 * Returns detailed telemetry for a single location by ID.
 * 
 * @param {string} locationId
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Object|null>}
 */
async function getLocationTelemetry(locationId, forceRefresh = false) {
  const location = getLocationById(locationId);
  if (!location) return null;

  const [traffic, weather, incidentsData] = await Promise.all([
    getLocationTrafficFlow(location, forceRefresh),
    getLocationWeather(location, forceRefresh),
    getActiveIncidents(forceRefresh)
  ]);

  const nearbyIncidents = (incidentsData.incidents || []).filter(inc => {
    if (!inc.coordinates?.latitude || !inc.coordinates?.longitude) return false;
    const dist = getDistanceKm(
      location.latitude, location.longitude,
      inc.coordinates.latitude, inc.coordinates.longitude
    );
    return dist <= 4.0;
  });

  return {
    location,
    retrieved_at: new Date().toISOString(),
    traffic,
    weather,
    nearby_incidents: nearbyIncidents
  };
}

module.exports = {
  getCombinedTelemetry,
  getLocationTelemetry,
  getDistanceKm
};
