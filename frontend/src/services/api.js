// src/services/api.js
//
// Centralised API client for the Smart Traffic Management frontend.
// All fetch calls target the Express backend on http://localhost:5000.
// Every function throws on failure so callers can show clean error states.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} returned ${res.status}: ${text}`);
  }
  return res.json();
}

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

// GET /api/zones  — Hyderabad zone coordinates + derived risk scores
export async function fetchZones() {
  return apiFetch('/api/zones');
}

// GET /api/incidents — Frame-level high-density events
export async function fetchIncidents() {
  return apiFetch('/api/incidents');
}

// GET /api/cameras — Camera feed metadata
export async function fetchCameras() {
  return apiFetch('/api/cameras');
}
