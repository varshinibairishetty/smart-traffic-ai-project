// backend/__tests__/riskCalculator.test.js
//
// Unit tests for the deterministic accident risk heuristic (Rt formula).
// Verifies score bounds, category mapping, heavy vehicle fleet mix penalties,
// and congestion thresholds.

const { calculateRisk, getRiskCategory } = require('../utils/riskCalculator');

describe('Accident Risk Heuristic (Rt Formula)', () => {
  describe('Risk Category Mapping (getRiskCategory)', () => {
    test('correctly maps scores to Low risk category (0 - 34)', () => {
      expect(getRiskCategory(0)).toBe('Low');
      expect(getRiskCategory(15)).toBe('Low');
      expect(getRiskCategory(34)).toBe('Low');
    });

    test('correctly maps scores to Medium risk category (35 - 66)', () => {
      expect(getRiskCategory(35)).toBe('Medium');
      expect(getRiskCategory(50)).toBe('Medium');
      expect(getRiskCategory(66)).toBe('Medium');
    });

    test('correctly maps scores to High risk category (67 - 84)', () => {
      expect(getRiskCategory(67)).toBe('High');
      expect(getRiskCategory(75)).toBe('High');
      expect(getRiskCategory(84)).toBe('High');
    });

    test('correctly maps scores to Critical risk category (85 - 100)', () => {
      expect(getRiskCategory(85)).toBe('Critical');
      expect(getRiskCategory(92)).toBe('Critical');
      expect(getRiskCategory(100)).toBe('Critical');
    });
  });

  describe('calculateRisk Evaluation', () => {
    test('handles empty or zero-traffic detection payload safely', () => {
      const emptyData = {
        summary: { avg_vehicles_per_frame: 0, by_class: {} },
        frames: [{ vehicle_count: 0 }]
      };
      const result = calculateRisk(emptyData);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(34);
      expect(result.category).toBe('Low');
      expect(result.details).toBeDefined();
    });

    test('ensures calculated risk score never exceeds 100', () => {
      const extremeData = {
        summary: {
          avg_vehicles_per_frame: 100,
          peak_vehicles_in_frame: 100,
          by_class: { truck: 50, bus: 50 }
        },
        frames: [{ vehicle_count: 100, timestamp_sec: 1.0 }]
      };
      const result = calculateRisk(extremeData);

      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.category).toBe('Critical');
    });

    test('penalizes heavy vehicle fleet mix (trucks and buses)', () => {
      const passengerCarsOnly = {
        summary: { avg_vehicles_per_frame: 15, by_class: { car: 15 } },
        frames: [{ vehicle_count: 15 }]
      };

      const heavyCommercialMix = {
        summary: { avg_vehicles_per_frame: 15, by_class: { truck: 10, bus: 5 } },
        frames: [{ vehicle_count: 15 }]
      };

      const scoreCars = calculateRisk(passengerCarsOnly).score;
      const scoreHeavy = calculateRisk(heavyCommercialMix).score;

      expect(scoreHeavy).toBeGreaterThan(scoreCars);
    });

    test('is strictly deterministic across identical inputs', () => {
      const sample = {
        summary: { avg_vehicles_per_frame: 18, by_class: { car: 12, bus: 3, motorcycle: 3 } },
        frames: [{ vehicle_count: 18 }]
      };

      const run1 = calculateRisk(sample);
      const run2 = calculateRisk(sample);

      expect(run1.score).toBe(run2.score);
      expect(run1.category).toBe(run2.category);
    });
  });
});
