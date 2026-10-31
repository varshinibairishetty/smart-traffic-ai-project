// backend/__tests__/cameraManager.test.js
// Unit tests for Local Video Folder Ingestion & Active Camera Manager

const fs = require('fs');
const path = require('path');
const { scanLocalVideoCameras, getVideosDirectory } = require('../utils/cameraManager');

describe('Local Video Folder Ingestion & Active Camera Manager', () => {
  test('scans local videos folder and returns active cameras', () => {
    const result = scanLocalVideoCameras();

    expect(result).toHaveProperty('cameras');
    expect(result.cameras.length).toBeGreaterThanOrEqual(1);

    const firstCam = result.cameras[0];
    expect(firstCam).toHaveProperty('id');
    expect(firstCam).toHaveProperty('name');
    expect(firstCam).toHaveProperty('location');
    expect(firstCam).toHaveProperty('filename');
    expect(firstCam).toHaveProperty('vehicle_count');
    expect(firstCam.vehicle_count).toBeGreaterThan(0);
    expect(firstCam.breakdown).toHaveProperty('car');
    expect(firstCam.risk).toHaveProperty('score');
    expect(firstCam.status).toBe('LIVE');
  });

  test('dynamically derives Active Incidents from high density cameras', () => {
    const result = scanLocalVideoCameras();

    expect(result).toHaveProperty('active_incidents');
    expect(Array.isArray(result.active_incidents)).toBe(true);

    if (result.active_incidents.length > 0) {
      const inc = result.active_incidents[0];
      expect(inc).toHaveProperty('camera_id');
      expect(inc).toHaveProperty('location');
      expect(inc).toHaveProperty('risk_score');
      expect(inc).toHaveProperty('severity');
      expect(inc.status).toBe('Active');
    }
  });

  test('correctly identifies High Risk Zones with risk score >= 67', () => {
    const result = scanLocalVideoCameras();

    expect(result).toHaveProperty('high_risk_zones');
    result.high_risk_zones.forEach(zone => {
      expect(zone.risk_score).toBeGreaterThanOrEqual(67);
      expect(zone).toHaveProperty('recommendation');
    });
  });

  test('computes accurate summary statistics across all discovered video cameras', () => {
    const result = scanLocalVideoCameras();

    expect(result.summary.total_cameras).toBe(result.cameras.length);
    expect(result.summary.active_cameras_count).toBe(result.cameras.length);
    expect(result.summary.total_vehicles_detected).toBeGreaterThan(0);
  });
});
