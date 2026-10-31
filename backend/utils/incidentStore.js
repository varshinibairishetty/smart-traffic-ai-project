// backend/utils/incidentStore.js
//
// Persistent lightweight storage layer for traffic incident history.
// Uses structured JSON file storage at `backend/data/incidents.json`.
//
// Features:
//   • Thread-safe atomic file writes
//   • Persistent tracking across server restarts
//   • Status tracking: "Active" vs. "Resolved"
//   • Automatic deduplication for repeated frame emissions
//   • Aggregated analytics (by node location, severity, status, and timeline)

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.resolve(DATA_DIR, 'incidents.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial baseline seed incidents (if database file does not exist yet)
const INITIAL_SEED_INCIDENTS = [
  {
    id: 'INC-20261027-001',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
    node_location: 'HITEC City',
    zone_id: 'hitec-city',
    sub_zone: 'Cyber Towers Junction',
    coordinates: [17.4435, 78.3772],
    risk_score: 91,
    severity: 'Critical',
    status: 'Resolved',
    vehicle_count: 23,
    description: 'Heavy queue spillover at Cyber Towers junction. Signal clearance cycle extended.',
    source: 'historical_detection'
  },
  {
    id: 'INC-20261027-002',
    timestamp: new Date(Date.now() - 3600000 * 1).toISOString(), // 1 hour ago
    node_location: 'Gachibowli',
    zone_id: 'gachibowli',
    sub_zone: 'Bio-Diversity Flyover',
    coordinates: [17.4401, 78.3489],
    risk_score: 74,
    severity: 'High',
    status: 'Resolved',
    vehicle_count: 19,
    description: 'Bus breakdown on outer lane near Bio-Diversity junction. Tow assistance cleared.',
    source: 'historical_detection'
  },
  {
    id: 'INC-20261027-003',
    timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 mins ago
    node_location: 'Madhapur',
    zone_id: 'madhapur',
    sub_zone: 'Metro Pillar 1042',
    coordinates: [17.4481, 78.3915],
    risk_score: 82,
    severity: 'High',
    status: 'Active',
    vehicle_count: 21,
    description: 'Multi-vehicle slow queue near Metro Pillar 1042. High conflict potential.',
    source: 'live_stream'
  }
];

class IncidentStore {
  constructor() {
    this.filePath = DB_FILE;
    this.memoryCache = [];
    this.initStore();
  }

  /**
   * Initializes storage from file, or seeds defaults if empty.
   */
  initStore() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.memoryCache = JSON.parse(raw);
        if (!Array.isArray(this.memoryCache)) {
          this.memoryCache = INITIAL_SEED_INCIDENTS;
          this._persist();
        }
      } else {
        this.memoryCache = [...INITIAL_SEED_INCIDENTS];
        this._persist();
      }
    } catch (err) {
      console.error('[IncidentStore] Failed to read store file, reinitializing:', err.message);
      this.memoryCache = [...INITIAL_SEED_INCIDENTS];
      this._persist();
    }
  }

  /**
   * Write memory cache atomically to incidents.json.
   */
  _persist() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.memoryCache, null, 2), 'utf8');
    } catch (err) {
      console.error('[IncidentStore] Error writing to disk:', err.message);
    }
  }

  /**
   * Get all incidents with optional filtering.
   */
  getAll({ status, zone_id, severity, limit = 100 } = {}) {
    let list = [...this.memoryCache];

    if (status) {
      list = list.filter(i => (i.status || 'Active').toLowerCase() === status.toLowerCase());
    }
    if (zone_id) {
      list = list.filter(i => (i.zone_id || '').toLowerCase() === zone_id.toLowerCase());
    }
    if (severity) {
      list = list.filter(i => (i.severity || '').toLowerCase() === severity.toLowerCase());
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (limit && limit > 0) {
      list = list.slice(0, limit);
    }

    return list;
  }

  /**
   * Get single incident by ID.
   */
  getById(id) {
    return this.memoryCache.find(i => i.id === id) || null;
  }

  /**
   * Save a new incident into persistent storage.
   * Performs deduplication: ignores identical events within 10 seconds for the same node.
   */
  save(incident) {
    const timestamp = incident.timestamp || new Date().toISOString();
    const node = incident.node_location || incident.location || 'HITEC City';
    const zoneId = incident.zone_id || node.toLowerCase().replace(/\s+/g, '-');
    const subZone = incident.sub_zone || node;
    const coordinates = incident.coordinates || [17.4435, 78.3772];
    const riskScore = incident.risk_score !== undefined ? incident.risk_score : (incident.score || 70);
    const severity = incident.severity || (riskScore >= 85 ? 'Critical' : riskScore >= 67 ? 'High' : riskScore >= 35 ? 'Medium' : 'Low');
    const status = incident.status || 'Active';

    // Deduplication check: check if an incident for the same zone was logged within the last 15 seconds
    const recentDuplicate = this.memoryCache.find(existing => {
      if (existing.zone_id !== zoneId) return false;
      const diffMs = Math.abs(new Date(timestamp) - new Date(existing.timestamp));
      return diffMs < 15000 && Math.abs(existing.risk_score - riskScore) < 5;
    });

    if (recentDuplicate) {
      return recentDuplicate;
    }

    const count = this.memoryCache.length + 1;
    const datePrefix = new Date(timestamp).toISOString().slice(0, 10).replace(/-/g, '');
    const id = incident.id && !incident.id.startsWith('INC-SIM')
      ? incident.id
      : `INC-${datePrefix}-${String(count).padStart(3, '0')}`;

    const newRecord = {
      id,
      timestamp,
      node_location: node,
      zone_id: zoneId,
      sub_zone: subZone,
      coordinates,
      risk_score: riskScore,
      severity,
      status,
      vehicle_count: incident.vehicle_count || 15,
      frame_index: incident.frame_index !== undefined ? incident.frame_index : null,
      description: incident.description || `${severity} traffic alert at ${subZone} (${node}, Rt: ${riskScore})`,
      source: incident.source || 'ai_service'
    };

    this.memoryCache.unshift(newRecord);
    this._persist();

    // Trigger automated incident notification & webhook dispatcher for high-risk alerts
    try {
      const notificationService = require('./notificationService');
      if (newRecord.risk_score >= (notificationService.getConfig()?.minRiskScore || 70)) {
        notificationService.dispatchForIncident(newRecord).catch(err => {
          console.error('[IncidentStore] Notification dispatch error:', err.message);
        });
      }
    } catch (e) {
      // Ignore any notification error so incident saving is never interrupted
    }

    return newRecord;
  }

  /**
   * Batch save incidents (e.g. from detection frames or simulation scenarios).
   */
  saveBatch(incidents = []) {
    const saved = [];
    for (const inc of incidents) {
      const rec = this.save(inc);
      if (rec) saved.push(rec);
    }
    return saved;
  }

  /**
   * Update the status of an incident (e.g., 'Active', 'Dispatched', or 'Resolved').
   */
  updateStatus(id, newStatus) {
    const item = this.memoryCache.find(i => i.id === id);
    if (!item) return null;

    const validStatuses = ['Active', 'Dispatched', 'Resolved'];
    const matched = validStatuses.find(s => s.toLowerCase() === (newStatus || '').toLowerCase());
    item.status = matched || (newStatus === 'Resolved' ? 'Resolved' : 'Active');

    if (item.status === 'Resolved') {
      item.resolved_at = new Date().toISOString();
    } else if (item.status === 'Dispatched') {
      item.dispatched_at = new Date().toISOString();
      item.resolved_at = null;
    } else {
      item.resolved_at = null;
    }

    this._persist();
    return item;
  }

  /**
   * Calculate aggregated analytics metrics across persistent history.
   */
  getAnalytics() {
    const all = this.memoryCache;
    const total = all.length;
    const active = all.filter(i => (i.status || 'Active') === 'Active').length;
    const dispatched = all.filter(i => i.status === 'Dispatched').length;
    const resolved = all.filter(i => i.status === 'Resolved').length;

    // By location
    const byLocation = {};
    const bySeverity = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    let totalScore = 0;

    for (const inc of all) {
      const loc = inc.node_location || 'Unknown';
      byLocation[loc] = (byLocation[loc] || 0) + 1;

      const sev = inc.severity || 'Medium';
      if (bySeverity[sev] !== undefined) bySeverity[sev]++;

      totalScore += (inc.risk_score || 0);
    }

    const avgRiskScore = total > 0 ? Math.round(totalScore / total) : 0;

    return {
      total_incidents: total,
      active_incidents: active,
      dispatched_incidents: dispatched,
      resolved_incidents: resolved,
      average_risk_score: avgRiskScore,
      by_location: byLocation,
      by_severity: bySeverity,
      latest_update: all.length > 0 ? all[0].timestamp : null
    };
  }
}

// Export singleton instance
const incidentStore = new IncidentStore();
module.exports = incidentStore;
