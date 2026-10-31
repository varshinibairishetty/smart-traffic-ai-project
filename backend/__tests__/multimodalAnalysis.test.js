// backend/__tests__/multimodalAnalysis.test.js
//
// Unit & Integration Tests for Multimodal Analysis Architecture
// Validates strict separation between Mode A (Video Analysis) and Mode B (Location-Based Risk).

const { loadAllAccidents, getLocationAccidentHistory } = require('../services/accidentHistoryService');
const { processUploadedVideo } = require('../utils/videoUploadProcessor');
const { HYDERABAD_LOCATIONS, getLocationById } = require('../config/locations');

describe('Multimodal Traffic Analysis Architecture', () => {

  describe('Mode A: Traffic Video Analysis Isolation', () => {
    test('arbitrary video upload without metadata tags is explicitly marked UNKNOWN metadata', async () => {
      const mockFileInfo = {
        filename: 'arbitrary_dashcam.mp4',
        filepath: 'mock/path/arbitrary_dashcam.mp4',
        size: 1024 * 1024,
        mimetype: 'video/mp4',
        fields: {} // No location or timestamp supplied
      };

      const result = await processUploadedVideo(mockFileInfo);

      expect(result.metadata_status).toBe('UNKNOWN');
      expect(result.location).toContain('Unknown');
      expect(result.zone_id).toBeNull();
      expect(result.recorded_at).toBeNull();
      expect(result.metadata_note).toContain('unknown');
      expect(result.data_provenance.vehicle_detections).toBe('MEASURED');
    });

    test('video upload with known location metadata records proper corridor alignment', async () => {
      const mockFileInfo = {
        filename: 'junction_cam_hitec.mp4',
        filepath: 'mock/path/junction_cam_hitec.mp4',
        size: 2 * 1024 * 1024,
        mimetype: 'video/mp4',
        fields: {
          location_id: 'hitec-city',
          recorded_at: '2026-10-30T10:00:00Z'
        }
      };

      const result = await processUploadedVideo(mockFileInfo);

      expect(result.metadata_status).toBe('KNOWN');
      expect(result.zone_id).toBe('hitec-city');
      expect(result.location).toContain('HITEC City');
      expect(result.recorded_at).toBe('2026-10-30T10:00:00Z');
      expect(result.data_provenance.vehicle_detections).toBe('MEASURED');
    });
  });

  describe('Mode B: Location-Based Accident Risk & Historical Provenance', () => {
    test('loadAllAccidents loads archival records from JSON store', () => {
      const records = loadAllAccidents();
      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThan(0);
      expect(records[0]).toHaveProperty('accident_id');
      expect(records[0]).toHaveProperty('severity');
      expect(records[0]).toHaveProperty('coordinates');
    });

    test('getLocationAccidentHistory correctly calculates hotspot score and counts for HITEC City', () => {
      const history = getLocationAccidentHistory('hitec-city');
      expect(history.location_id).toBe('hitec-city');
      expect(history.data_provenance).toBe('HISTORICAL_RECORD');
      expect(history.total_recorded_accidents).toBeGreaterThan(0);
      expect(history.hotspot_metrics.hotspot_score).toBeGreaterThanOrEqual(0);
      expect(history.hotspot_metrics.hotspot_score).toBeLessThanOrEqual(100);
      expect(history.hotspot_metrics).toHaveProperty('fatal_count');
      expect(history.hotspot_metrics).toHaveProperty('severe_count');
      expect(history.hotspot_metrics).toHaveProperty('minor_count');
    });

    test('returns 0 collisions and low risk gracefully for a location with no recorded accidents', () => {
      const history = getLocationAccidentHistory('non-existent-junction');
      expect(history.total_recorded_accidents).toBe(0);
      expect(history.hotspot_metrics.hotspot_score).toBe(0);
      expect(history.hotspot_metrics.hotspot_tier).toBe('Low Historical Risk');
      expect(history.accidents).toEqual([]);
    });

    test('all 6 Hyderabad configured locations have valid WGS84 coordinates and metadata', () => {
      expect(HYDERABAD_LOCATIONS.length).toBe(6);
      HYDERABAD_LOCATIONS.forEach(loc => {
        expect(loc.id).toBeDefined();
        expect(loc.name).toBeDefined();
        expect(loc.latitude).toBeGreaterThan(17.0);
        expect(loc.latitude).toBeLessThan(18.0);
        expect(loc.longitude).toBeGreaterThan(78.0);
        expect(loc.longitude).toBeLessThan(79.0);
        expect(loc.speed_limit_kmh).toBeGreaterThan(0);
      });
    });
  });

});
