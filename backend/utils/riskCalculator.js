// backend/utils/riskCalculator.js
//
// Rule-based accident risk calculator for the Smart Traffic Management MVP.
//
// ⚠️ TRANSPARENT DEMO INDICATOR:
// This calculation is a deterministic engineering heuristic, NOT a trained black-box model.
// As documented in `docs/feats/dataset-review-and-limitations.md`, public accident databases
// (e.g. UK STATS19, US Accidents) cannot be matched spatiotemporally to public video feeds
// without fabricating coordinates or labels.
//
// Mathematical Formulation:
//   R_t = min(100, w_d * D_t + w_v * V_trend + w_m * M_t + w_p * P_t)
//
// Where:
//   - D_t: Traffic density (%) normalized against saturation threshold (K_sat = 25 veh)
//   - V_trend: Sustained vehicle volume across sampled frames
//   - M_t: Fleet composition penalty for heavy/maneuverability-limited vehicles (trucks, buses, motorcycles)
//   - P_t: Congestion penalty if D_t >= 70%
//   - Weights: w_d = 0.55, w_v = 0.20, w_m = 0.15, w_p = 0.10

/**
 * Maps a numerical risk score (0 to 100) into 4 standard categories.
 * 
 * @param {number} score - The numerical risk score [0 - 100]
 * @returns {string} 'Low' | 'Medium' | 'High' | 'Critical'
 */
function getRiskCategory(score) {
  if (score < 35) return 'Low';       // 0 - 34: Normal flow
  if (score < 67) return 'Medium';    // 35 - 66: Moderate accumulation
  if (score < 85) return 'High';      // 67 - 84: Heavy queue, elevated conflict potential
  return 'Critical';                  // 85 - 100: Severe congestion / gridlock
}

/**
 * Calculates rule-based accident risk from YOLO frame-level detection data.
 * 
 * @param {Object} detectionData - Structured detection data
 * @param {Object} detectionData.summary - Summary metrics from AI detection
 * @param {Array} detectionData.frames - Array of frame detection records
 * @returns {Object} { score: number, category: string, breakdown: Object }
 */
function calculateRisk(detectionData = {}) {
  const summary = detectionData.summary || {};
  const frames = detectionData.frames || [];
  const latestFrame = frames.length > 0 ? frames[frames.length - 1] : null;

  // 1. Current vehicle count in latest frame (fallback to summary average)
  const currentCount = latestFrame 
    ? latestFrame.vehicle_count 
    : (summary.avg_vehicles_per_frame || 0);

  // 2. Traffic Density (D_t): Normalized against nominal capacity K_sat = 25 vehicles
  const K_SAT = 25;
  const densityPct = Math.min(Math.round((currentCount / K_SAT) * 100), 100);

  // 3. Volume Trend (V_trend): Average vehicle volume across recent window
  const avgVehicles = summary.avg_vehicles_per_frame || currentCount || 0;
  // Scaled relative to standard lane volume (0-100 scale)
  const volumeTrendFactor = Math.min(avgVehicles * 4, 100);

  // 4. Heavy Vehicle / Fleet Composition Penalty (M_t):
  // Trucks, buses, and motorcycles introduce braking differentials and visibility blind spots
  let nTrucks = 0;
  let nBuses = 0;
  let nMotorcycles = 0;

  if (latestFrame && latestFrame.vehicles) {
    for (const v of latestFrame.vehicles) {
      const cls = (v.vehicle_class || '').toLowerCase();
      if (cls === 'truck') nTrucks++;
      else if (cls === 'bus') nBuses++;
      else if (cls === 'motorcycle') nMotorcycles++;
    }
  } else if (summary.by_class) {
    nTrucks = summary.by_class.truck || 0;
    nBuses = summary.by_class.bus || 0;
    nMotorcycles = summary.by_class.motorcycle || 0;
  }

  const effectiveCount = currentCount > 0 ? currentCount : 1;
  // Weighted heavy vehicle ratio
  const fleetMixPenalty = Math.min(
    ((nTrucks * 2.0 + nBuses * 1.5 + nMotorcycles * 1.2) / effectiveCount) * 100,
    100
  );

  // 5. Congestion Factor (P_t): Triggered when density crosses 70%
  const congestionPenalty = densityPct >= 70 
    ? Math.min(((densityPct - 70) / 30) * 100, 100) 
    : 0;

  // 6. Calibrated Weighting Formula
  const W_D = 0.55;  // Density factor weight
  const W_V = 0.20;  // Volume trend weight
  const W_M = 0.15;  // Fleet composition weight
  const W_P = 0.10;  // Congestion penalty weight

  const rawScore = (W_D * densityPct) +
                   (W_V * volumeTrendFactor) +
                   (W_M * fleetMixPenalty) +
                   (W_P * congestionPenalty);

  // Clamp integer score to [0, 100]
  const finalScore = Math.min(Math.max(Math.round(rawScore), 0), 100);
  const category = getRiskCategory(finalScore);

  return {
    score: finalScore,
    category: category,
    details: {
      density_factor: densityPct,
      volume_trend_factor: Math.round(volumeTrendFactor),
      fleet_mix_penalty: Math.round(fleetMixPenalty),
      congestion_penalty: Math.round(congestionPenalty),
      vehicle_count_analyzed: currentCount,
      heavy_vehicles_count: nTrucks + nBuses,
      formula: "min(100, 0.55*D + 0.20*V + 0.15*M + 0.10*P)",
      model_type: "Rule-Based Deterministic Heuristic (Demo Indicator)"
    }
  };
}

module.exports = {
  calculateRisk,
  getRiskCategory
};
