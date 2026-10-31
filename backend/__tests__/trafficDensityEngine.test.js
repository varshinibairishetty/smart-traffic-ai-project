// backend/__tests__/trafficDensityEngine.test.js
// Unit tests for Stage 4 Traffic Density & Congestion Analysis Engine.

const {
  DEFAULT_SATURATION_CAPACITY,
  classifyCongestion,
  analyzeDensity,
  calculateIntervalVolume
} = require('../utils/trafficDensityEngine');

describe('Traffic Density & Congestion Analysis Engine', () => {
  describe('Flow Classification (classifyCongestion)', () => {
    test('classifies density < 40% as Free Flow (LOS A/B)', () => {
      const res = classifyCongestion(25.0);
      expect(res.status).toBe('Free Flow');
      expect(res.tier).toBe('Low');
      expect(res.los).toBe('A/B');
    });

    test('classifies density 40% - 69.9% as Moderate (LOS C/D)', () => {
      const res = classifyCongestion(55.0);
      expect(res.status).toBe('Moderate');
      expect(res.tier).toBe('Medium');
      expect(res.los).toBe('C/D');
    });

    test('classifies density 70% - 84.9% as Congested (LOS E)', () => {
      const res = classifyCongestion(75.0);
      expect(res.status).toBe('Congested');
      expect(res.tier).toBe('High');
      expect(res.los).toBe('E');
    });

    test('classifies density >= 85% as Severe Bottleneck (LOS F)', () => {
      const res = classifyCongestion(90.0);
      expect(res.status).toBe('Severe Bottleneck');
      expect(res.tier).toBe('Critical');
      expect(res.los).toBe('F');
    });
  });

  describe('analyzeDensity Calculation', () => {
    test('clamps density percentage between 0 and 100', () => {
      const normal = analyzeDensity({ vehicleCount: 10, kSat: 25 });
      expect(normal.density_pct).toBe(40.0);

      const overflow = analyzeDensity({ vehicleCount: 50, kSat: 25 });
      expect(overflow.density_pct).toBe(100.0);
    });

    test('computes flow rate in vehicles per minute from line crossings', () => {
      const res = analyzeDensity({
        vehicleCount: 15,
        kSat: 25,
        uniqueVehicles: 30,
        lineCrossings: 20,
        durationSec: 30.0 // 0.5 minutes -> 40 vpm
      });
      expect(res.flow_rate_vpm).toBe(40.0);
      expect(res.total_line_crossings).toBe(20);
      expect(res.unique_vehicles_tracked).toBe(30);
    });
  });

  describe('calculateIntervalVolume', () => {
    test('groups frame counts into rolling time intervals', () => {
      const sampleFrames = [
        { timestamp_sec: 2.0, vehicle_count: 5 },
        { timestamp_sec: 4.0, vehicle_count: 7 },
        { timestamp_sec: 12.0, vehicle_count: 14 }
      ];
      const intervals = calculateIntervalVolume(sampleFrames, 10);
      expect(intervals.length).toBe(2);
      expect(intervals[0].interval_label).toBe('0s–10s');
      expect(intervals[0].avg_vehicles).toBe(6.0);
      expect(intervals[0].peak_vehicles).toBe(7);
      expect(intervals[1].interval_label).toBe('10s–20s');
      expect(intervals[1].avg_vehicles).toBe(14.0);
    });
  });
});
