// backend/utils/trafficDensityEngine.js
//
// Stage 4 Traffic Density & Congestion Analysis Engine for Node.js API Gateway.
// Calculates corridor density, Level of Service (LOS), flow throughput,
// and interval volume rollups.

const DEFAULT_SATURATION_CAPACITY = 25; // K_sat: max simultaneous vehicles before congestion

/**
 * Classifies congestion status based on density percentage.
 * @param {number} densityPct (0 - 100)
 */
function classifyCongestion(densityPct) {
  if (densityPct >= 85) {
    return {
      status: 'Severe Bottleneck',
      tier: 'Critical',
      color: '#ef4444',
      los: 'F',
      description: 'Corridor capacity exceeded; gridlock conditions imminent.'
    };
  }
  if (densityPct >= 70) {
    return {
      status: 'Congested',
      tier: 'High',
      color: '#f97316',
      los: 'E',
      description: 'High vehicle accumulation; stop-and-go delays observed.'
    };
  }
  if (densityPct >= 40) {
    return {
      status: 'Moderate',
      tier: 'Medium',
      color: '#fbbf24',
      los: 'C/D',
      description: 'Stable traffic stream approaching intersection capacity.'
    };
  }
  return {
    status: 'Free Flow',
    tier: 'Low',
    color: '#22c55e',
    los: 'A/B',
    description: 'Unimpeded vehicular movement operating well below saturation.'
  };
}

/**
 * Computes corridor traffic density, saturation ratio, and operational classifications.
 * @param {number} vehicleCount Instantaneous vehicle count V_t
 * @param {number} kSat Saturation capacity threshold (default 25)
 * @param {number} uniqueVehicles Distinct tracked vehicles
 * @param {number} lineCrossings Total line crossings (Q)
 * @param {number} durationSec Video timestamp in seconds
 */
function analyzeDensity({
  vehicleCount = 0,
  kSat = DEFAULT_SATURATION_CAPACITY,
  uniqueVehicles = 0,
  lineCrossings = 0,
  durationSec = 1.0
}) {
  const safeKSat = Math.max(1, kSat);
  const densityPct = Math.min(100, Math.round(((vehicleCount / safeKSat) * 100) * 10) / 10);
  const minutes = Math.max(0.016, durationSec / 60);
  const flowRateVpm = Math.round((lineCrossings / minutes) * 10) / 10;
  const classification = classifyCongestion(densityPct);

  return {
    instantaneous_vehicles: vehicleCount,
    saturation_capacity: safeKSat,
    density_pct: densityPct,
    congestion_status: classification.status,
    congestion_tier: classification.tier,
    congestion_color: classification.color,
    level_of_service: classification.los,
    operational_note: classification.description,
    flow_rate_vpm: flowRateVpm,
    total_line_crossings: lineCrossings,
    unique_vehicles_tracked: uniqueVehicles
  };
}

/**
 * Calculates rolling traffic volume across defined time intervals.
 * @param {Array} frames Array of frame detection records
 * @param {number} intervalSec Size of time window in seconds (default 10s)
 */
function calculateIntervalVolume(frames = [], intervalSec = 10) {
  if (!frames || frames.length === 0) return [];

  const intervals = [];
  const maxTime = Math.max(...frames.map(f => f.timestamp_sec || 0), 1);
  const numBuckets = Math.ceil(maxTime / intervalSec);

  for (let b = 0; b < numBuckets; b++) {
    const startSec = b * intervalSec;
    const endSec = (b + 1) * intervalSec;
    const bucketFrames = frames.filter(f => (f.timestamp_sec || 0) >= startSec && (f.timestamp_sec || 0) < endSec);
    const avgVehicles = bucketFrames.length > 0
      ? Math.round((bucketFrames.reduce((acc, f) => acc + (f.vehicle_count || 0), 0) / bucketFrames.length) * 10) / 10
      : 0;
    const peakVehicles = bucketFrames.length > 0
      ? Math.max(...bucketFrames.map(f => f.vehicle_count || 0))
      : 0;

    intervals.push({
      interval_label: `${startSec}s–${endSec}s`,
      start_sec: startSec,
      end_sec: endSec,
      avg_vehicles: avgVehicles,
      peak_vehicles: peakVehicles,
      frame_count: bucketFrames.length
    });
  }

  return intervals;
}

module.exports = {
  DEFAULT_SATURATION_CAPACITY,
  classifyCongestion,
  analyzeDensity,
  calculateIntervalVolume
};
