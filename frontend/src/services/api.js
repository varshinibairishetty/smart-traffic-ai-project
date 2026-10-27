// src/services/api.js
//
// Client helper to fetch live vehicle detection data from Express backend.

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Fetches vehicle detections from the backend.
 * Returns response JSON or throws an Error.
 */
export async function fetchDetections() {
  const response = await fetch(`${API_BASE_URL}/detections`, {
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    let errMessage = `Server returned status ${response.status}`;
    try {
      const errData = await response.json();
      if (errData && errData.message) {
        errMessage = errData.message;
      }
    } catch (_) {
      // ignore JSON parse error for error response
    }
    throw new Error(errMessage);
  }

  return await response.json();
}

/**
 * Checks backend API health status.
 */
export async function checkBackendHealth() {
  const response = await fetch(`${API_BASE_URL}/health`, {
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return await response.json();
}
