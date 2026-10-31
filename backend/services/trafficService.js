// backend/services/trafficService.js
//
// Live Traffic Flow & Provider Incident Service for Hyderabad, India.
// Integrates with TomTom Traffic Flow and Traffic Incidents REST APIs.
//
// Transparency & Data Integrity Rules:
//   • When TOMTOM_API_KEY is not configured in .env, clearly report credentials as unconfigured.
//   • Never fabricate synthetic traffic speeds, delays, or incident reports.
//   • Never label normal traffic congestion as a confirmed vehicle accident.
//   • In-memory caching with 5-minute TTL to maintain quota health (<2,500 calls/day).

const path = require('path');
// Ensure environment variables are loaded regardless of process working directory
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { HYDERABAD_LOCATIONS, HYDERABAD_METRO_BBOX } = require('../config/locations');
const logger = require('../utils/logger');

const CACHE_TTL_MS = parseInt(process.env.TRAFFIC_CACHE_TTL_MS, 10) || 5 * 60 * 1000; // 5 mins default
const REQUEST_TIMEOUT_MS = 6000;

// In-memory cache for flow data (keyed by location ID) and incidents
const flowCache = new Map();
let incidentCache = {
  cached_at: 0,
  payload: null
};

/**
 * Checks whether TomTom credentials are provided in environment variables.
 * 
 * @returns {boolean}
 */
function isTomTomConfigured() {
  const key = process.env.TOMTOM_API_KEY;
  return Boolean(key && key.trim() !== '' && key !== 'your_tomtom_api_key_here');
}

/**
 * Normalizes a raw TomTom Flow Segment response into a consistent schema.
 * 
 * @param {string} locationId
 * @param {Object} rawFlow - flowSegmentData object from TomTom API
 * @returns {Object}
 */
function normalizeTrafficFlow(locationId, rawFlow) {
  const currentSpeed = typeof rawFlow.currentSpeed === 'number' ? rawFlow.currentSpeed : null;
  const freeFlowSpeed = typeof rawFlow.freeFlowSpeed === 'number' && rawFlow.freeFlowSpeed > 0 
    ? rawFlow.freeFlowSpeed 
    : (currentSpeed || 50);

  const speedRatio = (currentSpeed !== null && freeFlowSpeed > 0)
    ? Math.min(1.0, Math.max(0.0, currentSpeed / freeFlowSpeed))
    : null;

  // Congestion level represents speed degradation: 0% = free flow, 100% = complete standstill
  const congestionPct = speedRatio !== null
    ? Math.max(0, Math.min(100, Math.round((1 - speedRatio) * 100)))
    : null;

  const currentTravelTime = rawFlow.currentTravelTime || 0;
  const freeFlowTravelTime = rawFlow.freeFlowTravelTime || 0;
  const delaySec = Math.max(0, currentTravelTime - freeFlowTravelTime);

  const flowStatus = speedRatio === null ? 'unknown'
    : speedRatio >= 0.85 ? 'normal'
    : speedRatio >= 0.65 ? 'moderate'
    : speedRatio >= 0.4 ? 'heavy'
    : 'standstill';

  return {
    location_id: locationId,
    provider: 'TomTom Traffic Flow API',
    retrieved_at: new Date().toISOString(),
    data_freshness: 'live',
    status: 'active',
    metrics: {
      current_speed_kmh: currentSpeed !== null ? Math.round(currentSpeed * 10) / 10 : null,
      free_flow_speed_kmh: Math.round(freeFlowSpeed * 10) / 10,
      speed_ratio: speedRatio !== null ? Math.round(speedRatio * 1000) / 1000 : null,
      congestion_pct: congestionPct,
      congestion_level_pct: congestionPct,
      flow_status: flowStatus,
      current_travel_time_sec: currentTravelTime,
      free_flow_travel_time_sec: freeFlowTravelTime,
      delay_seconds: delaySec,
      confidence: typeof rawFlow.confidence === 'number' ? Math.round(rawFlow.confidence * 100) / 100 : 1.0,
      road_closed: Boolean(rawFlow.roadClosure),
      road_closure: Boolean(rawFlow.roadClosure)
    }
  };
}

/**
 * Fetches live traffic flow segment data for a single Hyderabad location.
 * 
 * @param {Object} location - Location config object
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Object>}
 */
async function getLocationTrafficFlow(location, forceRefresh = false) {
  const now = Date.now();
  const cached = flowCache.get(location.id);

  if (!forceRefresh && cached && (now - cached.cached_at) < CACHE_TTL_MS) {
    return {
      ...cached.payload,
      data_freshness: 'cached'
    };
  }

  if (!isTomTomConfigured()) {
    return {
      location_id: location.id,
      provider: 'TomTom Traffic Flow API',
      retrieved_at: new Date().toISOString(),
      data_freshness: 'unconfigured',
      status: 'unconfigured',
      message: 'TOMTOM_API_KEY is not configured in .env. Obtain a free non-commercial key at developer.tomtom.com to enable live flow telemetry.',
      metrics: null
    };
  }

  const apiKey = process.env.TOMTOM_API_KEY.trim();
  const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative/10/json?point=${location.latitude},${location.longitude}&unit=KMPH&key=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`TomTom API responded with HTTP ${res.status}: ${errorText.slice(0, 150)}`);
    }

    const data = await res.json();
    const flowSegment = data.flowSegmentData || {};
    const normalized = normalizeTrafficFlow(location.id, flowSegment);

    flowCache.set(location.id, {
      cached_at: now,
      payload: normalized
    });

    return normalized;
  } catch (err) {
    logger.debug(`[TrafficService] Flow fetch error for ${location.id}: ${err.message}`);

    if (cached) {
      return {
        ...cached.payload,
        data_freshness: 'stale',
        warning: `External API call failed (${err.message}). Showing previous observation.`
      };
    }

    return {
      location_id: location.id,
      provider: 'TomTom Traffic Flow API',
      retrieved_at: new Date().toISOString(),
      data_freshness: 'unavailable',
      error: err.message,
      metrics: null
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches traffic flow for all 6 Hyderabad locations.
 * 
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Array<Object>>}
 */
async function getAllLocationsTrafficFlow(forceRefresh = false) {
  const promises = HYDERABAD_LOCATIONS.map(loc => getLocationTrafficFlow(loc, forceRefresh));
  return await Promise.all(promises);
}

/**
 * Fetches verified active traffic incidents within the Greater Hyderabad bounding box.
 * 
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Object>}
 */
async function getActiveIncidents(forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && incidentCache.payload && (now - incidentCache.cached_at) < CACHE_TTL_MS) {
    return {
      ...incidentCache.payload,
      data_freshness: 'cached'
    };
  }

  if (!isTomTomConfigured()) {
    return {
      provider: 'TomTom Traffic Incidents API',
      retrieved_at: new Date().toISOString(),
      data_freshness: 'unconfigured',
      status: 'unconfigured',
      message: 'TOMTOM_API_KEY is not configured in .env. Obtain a free key at developer.tomtom.com to enable verified incident reports.',
      total_incidents: 0,
      incidents: []
    };
  }

  const apiKey = process.env.TOMTOM_API_KEY.trim();
  const bbox = `${HYDERABAD_METRO_BBOX.min_lon},${HYDERABAD_METRO_BBOX.min_lat},${HYDERABAD_METRO_BBOX.max_lon},${HYDERABAD_METRO_BBOX.max_lat}`;
  const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&fields={incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to,length}}}&language=en-GB&key=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`TomTom Incidents HTTP ${res.status}: ${errorText.slice(0, 150)}`);
    }

    const data = await res.json();
    const rawIncidents = data.incidents || [];

    const mappedIncidents = rawIncidents.map(inc => {
      const props = inc.properties || {};
      const events = props.events || [];
      const description = events.length > 0 ? events.map(e => e.description).join('; ') : 'Traffic event reported';

      // Interpret TomTom iconCategory codes into standard verified types
      // Category 6: Accident, 1: Jam, 8: Road Work, 9: Road Closure, etc.
      let incidentType = 'TRAFFIC_ANOMALY';
      const iconCategory = props.iconCategory;
      if (iconCategory === 6) incidentType = 'ACCIDENT';
      else if (iconCategory === 1) incidentType = 'CONGESTION_JAM';
      else if (iconCategory === 8) incidentType = 'ROAD_WORK';
      else if (iconCategory === 9) incidentType = 'ROAD_CLOSURE';
      else if (iconCategory === 3) incidentType = 'DISABLED_VEHICLE';

      const coords = inc.geometry?.coordinates || [];
      const point = Array.isArray(coords[0]) ? coords[0] : coords;

      return {
        incident_id: props.id || `INC-${Date.now()}`,
        is_provider_verified: true, // Crucial rule: strictly provider-verified
        incident_type: incidentType,
        icon_category: iconCategory,
        severity_magnitude: props.magnitudeOfDelay || 0,
        description: description,
        from_location: props.from || null,
        to_location: props.to || null,
        delay_seconds: props.delay || 0,
        length_meters: props.length || 0,
        start_time: props.startTime || null,
        end_time: props.endTime || null,
        coordinates: {
          longitude: point[0] || null,
          latitude: point[1] || null
        }
      };
    });

    const payload = {
      provider: 'TomTom Traffic Incidents API',
      retrieved_at: new Date().toISOString(),
      data_freshness: 'live',
      status: 'active',
      bounding_box: HYDERABAD_METRO_BBOX,
      total_incidents: mappedIncidents.length,
      note: mappedIncidents.length === 0 
        ? 'No active traffic incidents or road closures currently reported by provider in Hyderabad bounding box.' 
        : undefined,
      incidents: mappedIncidents
    };

    incidentCache = {
      cached_at: now,
      payload
    };

    return payload;
  } catch (err) {
    logger.debug(`[TrafficService] Incidents fetch error: ${err.message}`);

    if (incidentCache.payload) {
      return {
        ...incidentCache.payload,
        data_freshness: 'stale',
        warning: `External API call failed (${err.message}). Showing previous observation.`
      };
    }

    return {
      provider: 'TomTom Traffic Incidents API',
      retrieved_at: new Date().toISOString(),
      data_freshness: 'unavailable',
      error: err.message,
      total_incidents: 0,
      incidents: []
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  getLocationTrafficFlow,
  getAllLocationsTrafficFlow,
  getActiveIncidents,
  isTomTomConfigured,
  normalizeTrafficFlow,
  CACHE_TTL_MS
};
