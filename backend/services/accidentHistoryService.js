// backend/services/accidentHistoryService.js
//
// Historical Accident Data Service for Hyderabad Corridors.
// Provides historical collision records, hotspot risk indices, and data provenance
// for location-based accident risk analysis (Mode B).
//
// Rules:
//   • Strictly returns recorded archival accident incidents with source provenance.
//   • Never fabricates collision entries or probabilities.
//   • Distinguishes between historical hotspot risk and live traffic congestion.

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const ACCIDENTS_FILE = path.resolve(__dirname, '../data/historical_accidents.json');

/**
 * Loads all historical accident records from disk.
 * @returns {Array<Object>}
 */
function loadAllAccidents() {
  try {
    if (!fs.existsSync(ACCIDENTS_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(ACCIDENTS_FILE, 'utf8');
    return JSON.parse(raw) || [];
  } catch (err) {
    logger.error('ACCIDENT_HISTORY', `Error reading historical accidents: ${err.message}`);
    return [];
  }
}

/**
 * Returns historical accident records and hotspot metrics for a specific location.
 * @param {string} locationId
 * @returns {Object}
 */
function getLocationAccidentHistory(locationId) {
  const allAccidents = loadAllAccidents();
  const cleanId = String(locationId || '').toLowerCase().trim();

  const matched = allAccidents.filter(a =>
    a.location_id.toLowerCase() === cleanId ||
    a.location_id.toLowerCase().replace(/-/g, '_') === cleanId.replace(/-/g, '_')
  );

  const fatalCount = matched.filter(a => (a.severity || '').toLowerCase() === 'fatal').length;
  const severeCount = matched.filter(a => (a.severity || '').toLowerCase() === 'severe').length;
  const minorCount = matched.filter(a => (a.severity || '').toLowerCase() === 'minor').length;
  const totalCasualties = matched.reduce((sum, a) => sum + (a.casualty_count || 0), 0);

  // Compute explainable Historical Hotspot Risk Index (0 - 100)
  // Weighted: Fatal = 25 pts, Severe = 15 pts, Minor = 5 pts, capped at 100
  const rawScore = (fatalCount * 25) + (severeCount * 15) + (minorCount * 5);
  const hotspotScore = Math.min(100, Math.max(0, rawScore));

  let hotspotTier = 'Low Historical Risk';
  let hotspotColor = '#4ade80';

  if (hotspotScore >= 60) {
    hotspotTier = 'High Historical Risk';
    hotspotColor = '#f43f5e';
  } else if (hotspotScore >= 30) {
    hotspotTier = 'Moderate Historical Risk';
    hotspotColor = '#fbbf24';
  }

  return {
    location_id: cleanId,
    data_provenance: 'HISTORICAL_RECORD',
    source: 'Municipal Police Incident Archive & Road Safety Audit',
    archival_period: '2023 - 2024',
    total_recorded_accidents: matched.length,
    hotspot_metrics: {
      hotspot_score: hotspotScore,
      hotspot_tier: hotspotTier,
      hotspot_color: hotspotColor,
      fatal_count: fatalCount,
      severe_count: severeCount,
      minor_count: minorCount,
      total_casualties: totalCasualties
    },
    accidents: matched
  };
}

module.exports = {
  loadAllAccidents,
  getLocationAccidentHistory
};
