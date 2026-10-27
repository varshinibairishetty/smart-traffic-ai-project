// backend/__tests__/geofence.test.js
//
// Unit tests for the Geo-Spatial Proximity & Geofencing Alert Engine.
// Verifies point-in-bounding-box containment, Haversine distance computation,
// and sub-zone assignment for Hyderabad tech corridor nodes.

const {
  HYDERABAD_GEOFENCES,
  calculateDistanceMeters,
  isPointInBoundingBox,
  matchGeofence,
  enrichWithGeofence
} = require('../utils/geofence');

describe('Geo-Spatial Proximity & Geofencing Engine', () => {
  describe('Geofence Definitions', () => {
    test('contains definitions for all key Hyderabad nodes', () => {
      const ids = HYDERABAD_GEOFENCES.map(g => g.id);
      expect(ids).toContain('hitec-city');
      expect(ids).toContain('gachibowli');
      expect(ids).toContain('madhapur');
      expect(ids).toContain('jubilee-hills');
      expect(ids).toContain('kondapur');
      expect(ids).toContain('banjara-hills');
    });

    test('each geofence has valid center, bounding box, polygon, and sub-zones', () => {
      HYDERABAD_GEOFENCES.forEach(fence => {
        expect(fence.center.lat).toBeGreaterThan(17.0);
        expect(fence.center.lon).toBeGreaterThan(78.0);
        expect(fence.bbox.minLat).toBeLessThan(fence.bbox.maxLat);
        expect(fence.bbox.minLon).toBeLessThan(fence.bbox.maxLon);
        expect(fence.polygon.length).toBe(4);
        expect(fence.sub_zones.length).toBeGreaterThan(0);
        expect(fence.primary_arterial).toBeDefined();
      });
    });
  });

  describe('Haversine Distance Formula', () => {
    test('calculates 0 meters for identical coordinates', () => {
      const dist = calculateDistanceMeters(17.4435, 78.3772, 17.4435, 78.3772);
      expect(dist).toBe(0);
    });

    test('calculates reasonable distance between HITEC City and Gachibowli (~3km)', () => {
      const dist = calculateDistanceMeters(17.4435, 78.3772, 17.4401, 78.3489);
      // Distance is ~3000m
      expect(dist).toBeGreaterThan(2500);
      expect(dist).toBeLessThan(3500);
    });
  });

  describe('Bounding Box Containment (isPointInBoundingBox)', () => {
    const hitec = HYDERABAD_GEOFENCES.find(g => g.id === 'hitec-city');

    test('returns true for coordinates strictly inside bounding box', () => {
      expect(isPointInBoundingBox(17.4435, 78.3772, hitec.bbox)).toBe(true);
    });

    test('returns false for coordinates outside bounding box', () => {
      expect(isPointInBoundingBox(17.3850, 78.4867, hitec.bbox)).toBe(false); // Hyderabad Old City
    });
  });

  describe('Spatial Geofence Matching (matchGeofence)', () => {
    test('matches GPS point at Cyber Towers to HITEC City geofence', () => {
      const match = matchGeofence(17.4435, 78.3772);
      expect(match).toBeDefined();
      expect(match.matched).toBe(true);
      expect(match.zone_id).toBe('hitec-city');
      expect(match.zone_name).toBe('HITEC City');
      expect(match.sub_zone).toBeDefined();
    });

    test('matches GPS point at Bio-Diversity to Gachibowli geofence', () => {
      const match = matchGeofence(17.4401, 78.3489);
      expect(match).toBeDefined();
      expect(match.matched).toBe(true);
      expect(match.zone_id).toBe('gachibowli');
      expect(match.zone_name).toBe('Gachibowli');
    });

    test('matches GPS point at Metro Pillar 1042 to Madhapur geofence', () => {
      const match = matchGeofence(17.4481, 78.3915);
      expect(match).toBeDefined();
      expect(match.matched).toBe(true);
      expect(match.zone_id).toBe('madhapur');
      expect(match.zone_name).toBe('Madhapur');
    });

    test('matches GPS point at Road 36 Checkpost to Jubilee Hills geofence', () => {
      const match = matchGeofence(17.4326, 78.4072);
      expect(match).toBeDefined();
      expect(match.matched).toBe(true);
      expect(match.zone_id).toBe('jubilee-hills');
      expect(match.zone_name).toBe('Jubilee Hills');
    });

    test('handles outlying coordinates via nearest proximity fallback', () => {
      // Point slightly outside bounding box
      const match = matchGeofence(17.4560, 78.3890);
      expect(match).toBeDefined();
      expect(match.zone_id).toBeDefined();
      expect(match.distance_meters).toBeGreaterThan(0);
    });
  });

  describe('Incident Payload Enrichment (enrichWithGeofence)', () => {
    test('enriches raw incident without coordinates by zone_id', () => {
      const raw = {
        zone_id: 'gachibowli',
        risk_score: 80,
        vehicle_count: 22
      };
      const enriched = enrichWithGeofence(raw);
      expect(enriched.coordinates).toEqual([17.4401, 78.3489]);
      expect(enriched.node_location).toBe('Gachibowli');
      expect(enriched.sub_zone).toBeDefined();
      expect(enriched.geofence).toBeDefined();
    });
  });
});
