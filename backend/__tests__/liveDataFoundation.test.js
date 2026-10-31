// backend/__tests__/liveDataFoundation.test.js
//
// Unit and integration tests for Phase 2 Live Data Foundation:
//   • Hyderabad locations catalog & bounding box
//   • Live weather normalization & caching
//   • Traffic flow normalization & unconfigured credential handling
//   • Telemetry aggregation and Haversine distance calculations

const { HYDERABAD_LOCATIONS, HYDERABAD_METRO_BBOX, getLocationById } = require('../config/locations');
const { interpretWeatherCode, getLocationWeather, getAllLocationsWeather } = require('../services/weatherService');
const { normalizeTrafficFlow, isTomTomConfigured, getLocationTrafficFlow } = require('../services/trafficService');
const { getDistanceKm, getCombinedTelemetry } = require('../services/telemetryAggregator');

describe('Phase 2: Live Data Foundation', () => {
  describe('1. Hyderabad Locations Configuration', () => {
    test('contains all 6 core configured Hyderabad monitoring junctions', () => {
      expect(HYDERABAD_LOCATIONS).toBeDefined();
      expect(HYDERABAD_LOCATIONS.length).toBe(6);

      const expectedIds = ['hitec-city', 'gachibowli', 'madhapur', 'kukatpally', 'punjagutta', 'secunderabad'];
      const actualIds = HYDERABAD_LOCATIONS.map(l => l.id);
      expect(actualIds).toEqual(expect.arrayContaining(expectedIds));
    });

    test('each location has valid coordinates, display names, and speed limits', () => {
      HYDERABAD_LOCATIONS.forEach(loc => {
        expect(loc.id).toBeTruthy();
        expect(loc.name).toBeTruthy();
        expect(loc.latitude).toBeGreaterThan(17.0);
        expect(loc.latitude).toBeLessThan(18.0);
        expect(loc.longitude).toBeGreaterThan(78.0);
        expect(loc.longitude).toBeLessThan(79.0);
        expect(loc.speed_limit_kmh).toBeGreaterThanOrEqual(40);
      });
    });

    test('getLocationById correctly looks up locations by exact ID and short name', () => {
      const hitec = getLocationById('hitec-city');
      expect(hitec).toBeDefined();
      expect(hitec.name).toContain('HITEC City');

      const gachibowli = getLocationById('Gachibowli');
      expect(gachibowli).toBeDefined();
      expect(gachibowli.id).toBe('gachibowli');

      const nonExistent = getLocationById('non-existent-junction');
      expect(nonExistent).toBeNull();
    });

    test('metropolitan bounding box encloses all 6 junctions', () => {
      HYDERABAD_LOCATIONS.forEach(loc => {
        expect(loc.latitude).toBeGreaterThanOrEqual(HYDERABAD_METRO_BBOX.min_lat);
        expect(loc.latitude).toBeLessThanOrEqual(HYDERABAD_METRO_BBOX.max_lat);
        expect(loc.longitude).toBeGreaterThanOrEqual(HYDERABAD_METRO_BBOX.min_lon);
        expect(loc.longitude).toBeLessThanOrEqual(HYDERABAD_METRO_BBOX.max_lon);
      });
    });
  });

  describe('2. Weather Normalization & Code Interpretation', () => {
    test('accurately interprets WMO weather codes', () => {
      expect(interpretWeatherCode(0).condition).toBe('Clear Sky');
      expect(interpretWeatherCode(2).condition).toBe('Partly Cloudy');
      expect(interpretWeatherCode(3).condition).toBe('Overcast');
      expect(interpretWeatherCode(45).condition).toContain('Fog');
      expect(interpretWeatherCode(61).condition).toBe('Rain');
      expect(interpretWeatherCode(65).condition).toBe('Heavy Rain');
      expect(interpretWeatherCode(95).condition).toBe('Thunderstorm');
    });

    test('handles missing or zero precipitation correctly', () => {
      const clear = interpretWeatherCode(0, 0);
      expect(clear.category).toBe('clear');

      const rainByPrecip = interpretWeatherCode(0, 3.5);
      expect(rainByPrecip.category).toBe('rain');
    });

    test('getLocationWeather returns structured normalized object with freshness indicator', async () => {
      const loc = HYDERABAD_LOCATIONS[0];
      const result = await getLocationWeather(loc);

      expect(result).toBeDefined();
      expect(result.location_id).toBe(loc.id);
      expect(result.provider).toBeTruthy();
      expect(result.conditions).toBeDefined();
      expect(['live', 'cached', 'stale', 'unavailable']).toContain(result.data_freshness);
    });
  });

  describe('3. Traffic Flow Normalization & Data Integrity', () => {
    test('accurately computes speed ratio, congestion percentage, and delay seconds', () => {
      const rawFlow = {
        currentSpeed: 20,
        freeFlowSpeed: 50,
        currentTravelTime: 360,
        freeFlowTravelTime: 144,
        confidence: 0.95,
        roadClosure: false
      };

      const normalized = normalizeTrafficFlow('hitec-city', rawFlow);

      expect(normalized.location_id).toBe('hitec-city');
      expect(normalized.metrics.current_speed_kmh).toBe(20);
      expect(normalized.metrics.free_flow_speed_kmh).toBe(50);
      expect(normalized.metrics.speed_ratio).toBe(0.4);
      // Congestion: 1 - 0.4 = 60%
      expect(normalized.metrics.congestion_level_pct).toBe(60);
      expect(normalized.metrics.delay_seconds).toBe(216);
      expect(normalized.metrics.road_closure).toBe(false);
    });

    test('correctly handles zero speed degradation as 0% congestion', () => {
      const freeFlow = {
        currentSpeed: 60,
        freeFlowSpeed: 60,
        currentTravelTime: 120,
        freeFlowTravelTime: 120,
        confidence: 1.0,
        roadClosure: false
      };

      const normalized = normalizeTrafficFlow('gachibowli', freeFlow);
      expect(normalized.metrics.congestion_level_pct).toBe(0);
      expect(normalized.metrics.delay_seconds).toBe(0);
    });

    test('reports unconfigured status transparently without inventing synthetic speeds when key is missing', async () => {
      const originalKey = process.env.TOMTOM_API_KEY;
      delete process.env.TOMTOM_API_KEY;

      const loc = HYDERABAD_LOCATIONS[1];
      const result = await getLocationTrafficFlow(loc);

      expect(result.data_freshness).toBe('unconfigured');
      expect(result.status).toBe('unconfigured');
      expect(result.message).toContain('TOMTOM_API_KEY');
      expect(result.metrics).toBeNull();

      if (originalKey) process.env.TOMTOM_API_KEY = originalKey;
    });
  });

  describe('4. Telemetry Aggregation & Spatial Haversine Distance', () => {
    test('accurately calculates distance between Hyderabad landmarks', () => {
      // HITEC City (17.4504, 78.3808) to Gachibowli (17.4401, 78.3489) ~ 3.5 km
      const dist = getDistanceKm(17.4504, 78.3808, 17.4401, 78.3489);
      expect(dist).toBeGreaterThan(3.0);
      expect(dist).toBeLessThan(4.5);
    });

    test('returns Infinity safely on null or invalid coordinates', () => {
      expect(getDistanceKm(null, null, 17.4, 78.4)).toBe(Infinity);
      expect(getDistanceKm(17.4, 78.4, undefined, null)).toBe(Infinity);
    });

    test('getCombinedTelemetry unifies all 6 locations with summary metrics', async () => {
      const telemetry = await getCombinedTelemetry();

      expect(telemetry).toBeDefined();
      expect(telemetry.city).toContain('Hyderabad');
      expect(telemetry.summary).toBeDefined();
      expect(telemetry.summary.total_monitored_locations).toBe(6);
      expect(telemetry.locations).toHaveLength(6);

      telemetry.locations.forEach(loc => {
        expect(loc.location_id).toBeTruthy();
        expect(loc.coordinates).toBeDefined();
        expect(loc.traffic).toBeDefined();
        expect(loc.weather).toBeDefined();
        expect(Array.isArray(loc.nearby_incidents)).toBe(true);
      });
    });
  });
});
