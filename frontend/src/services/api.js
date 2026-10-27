// src/services/api.js
//
// Centralised API client for the Smart Traffic Management frontend.
// All fetch calls target the Express backend on http://localhost:5000.
// Includes JWT Authorization headers from localStorage when available.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function getAuthHeaders() {
  const token = localStorage.getItem('traffic_ai_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...(options.headers || {})
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    let errorMsg = `API ${path} returned ${res.status}`;
    try {
      const data = await res.json();
      errorMsg = data.message || data.error || errorMsg;
    } catch {
      const text = await res.text();
      if (text) errorMsg = text;
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

// ─── Authentication API Endpoints ─────────────────────────────────────────────

// POST /api/auth/login
export async function loginUser(credentials) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
}

// POST /api/auth/register
export async function registerUser(userData) {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

// GET /api/auth/me
export async function fetchCurrentUser() {
  return apiFetch('/api/auth/me');
}

// ─── Detections & Risk Endpoints ──────────────────────────────────────────────

// GET /api/detections
export async function fetchDetections() {
  return apiFetch('/api/detections');
}

// GET /api/detections/latest
export async function fetchLatestDetection() {
  return apiFetch('/api/detections/latest');
}

// GET /api/risk
export async function fetchRisk() {
  return apiFetch('/api/risk');
}

// GET /api/zones — Hyderabad zone coordinates + derived risk scores
export async function fetchZones() {
  return apiFetch('/api/zones');
}

// GET /api/geofences — Geographical bounding boxes, polygons, and sub-zones
export async function fetchGeofences() {
  return apiFetch('/api/geofences');
}

// GET /api/incidents — Persistent incident history with optional filters
export async function fetchIncidents(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.zone_id) query.append('zone_id', params.zone_id);
  if (params.severity) query.append('severity', params.severity);
  if (params.limit) query.append('limit', params.limit);
  const qs = query.toString();
  return apiFetch(`/api/incidents${qs ? `?${qs}` : ''}`);
}

// GET /api/incidents/analytics — Aggregated incident metrics
export async function fetchIncidentAnalytics() {
  return apiFetch('/api/incidents/analytics');
}

// GET /api/analytics/summary — Comprehensive aggregated historical analytics & chart data
export async function fetchAnalyticsSummary() {
  return apiFetch('/api/analytics/summary');
}

// PATCH /api/incidents/:id/status — Update incident status ('Active' or 'Resolved') (Requires Admin)
export async function updateIncidentStatus(id, status) {
  return apiFetch(`/api/incidents/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

// POST /api/incidents/:id/resolve — Convenience method to resolve an incident (Requires Admin)
export async function resolveIncident(id) {
  return apiFetch(`/api/incidents/${id}/resolve`, {
    method: 'POST'
  });
}

// GET /api/cameras — Camera feed metadata
export async function fetchCameras() {
  return apiFetch('/api/cameras');
}

// GET /api/demo/scenarios — Available test/viva scenarios
export async function fetchScenarios() {
  return apiFetch('/api/demo/scenarios');
}

// POST /api/demo/scenario — Trigger scenario simulation (Requires Admin)
export async function triggerScenario(scenarioId) {
  return apiFetch('/api/demo/scenario', {
    method: 'POST',
    body: JSON.stringify({ scenario: scenarioId })
  });
}

// ─── Automated Incident Notification & Webhook Dispatcher Endpoints ──────────

// GET /api/notifications — Retrieve dispatch history log
export async function fetchNotifications(params = {}) {
  const query = new URLSearchParams();
  if (params.limit) query.append('limit', params.limit);
  if (params.channel) query.append('channel', params.channel);
  if (params.severity) query.append('severity', params.severity);
  const qs = query.toString();
  return apiFetch(`/api/notifications${qs ? `?${qs}` : ''}`);
}

// GET /api/notifications/config — Retrieve current channel toggles and trigger settings
export async function fetchNotificationConfig() {
  return apiFetch('/api/notifications/config');
}

// PATCH /api/notifications/config — Update channel toggles, risk threshold, and webhook URLs
export async function updateNotificationConfig(configUpdates) {
  return apiFetch('/api/notifications/config', {
    method: 'PATCH',
    body: JSON.stringify(configUpdates)
  });
}

// POST /api/notifications/test — Trigger synthetic test alert dispatch
export async function triggerTestNotification(payload = {}) {
  return apiFetch('/api/notifications/test', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
