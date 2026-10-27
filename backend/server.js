// backend/server.js
//
// Main entry point for the Smart Traffic Management backend API.
// Express server providing health checks, traffic detection data,
// and transparent rule-based accident risk calculations.

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { calculateRisk } = require('./utils/riskCalculator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS so the React frontend (running on port 5173) can access the API
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map(o => o.trim()),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Parse incoming JSON payloads
app.use(express.json());

// Resolve detection output path from environment or default
const detectionFilePath = path.resolve(
  __dirname,
  process.env.DETECTION_OUTPUT_PATH || '../ai-service/detection_output.json'
);

// ─── Hyderabad Zone Configuration ───────────────────────────────────────────
//
// ⚠️ SYNTHETIC DEMO DATA: These lat/lon coordinates are real map points for
// well-known Hyderabad tech-corridor locations, but the risk values are derived
// by applying per-zone traffic weight multipliers to the single global risk
// score computed from the local sample video. They are NOT location-specific
// sensor readings or real-time signal data.
//
const HYDERABAD_ZONES = [
  { id: 'hitec-city',    name: 'HITEC City',     lat: 17.4435, lon: 78.3772, weight: 1.20 },
  { id: 'gachibowli',   name: 'Gachibowli',     lat: 17.4401, lon: 78.3489, weight: 1.10 },
  { id: 'madhapur',     name: 'Madhapur',        lat: 17.4481, lon: 78.3915, weight: 1.00 },
  { id: 'kondapur',     name: 'Kondapur',        lat: 17.4600, lon: 78.3542, weight: 0.90 },
  { id: 'jubilee-hills',name: 'Jubilee Hills',   lat: 17.4326, lon: 78.4072, weight: 0.85 },
  { id: 'banjara-hills',name: 'Banjara Hills',   lat: 17.4138, lon: 78.4494, weight: 0.90 },
];

// Map a risk score to a traffic light colour used by the Live Map markers
function riskColor(score) {
  if (score >= 67) return 'red';
  if (score >= 35) return 'amber';
  return 'green';
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// Root route - Service metadata
app.get('/', (req, res) => {
  res.json({
    name: 'Smart Traffic AI - Backend API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      detections: 'GET /api/detections',
      latestDetections: 'GET /api/detections/latest',
      risk: 'GET /api/risk',
      zones: 'GET /api/zones',
      incidents: 'GET /api/incidents',
      cameras: 'GET /api/cameras'
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'traffic-backend-api',
    detectionFileFound: fs.existsSync(detectionFilePath)
  });
});

// GET /api/detections - Read vehicle detection data produced by AI service + calculated risk
app.get('/api/detections', (req, res) => {
  if (!fs.existsSync(detectionFilePath)) {
    return res.status(404).json({
      error: 'Detection data not found',
      message: `The file '${detectionFilePath}' does not exist yet. Please run vehicle detection in the AI service first (e.g. 'python test_detection.py').`
    });
  }

  fs.readFile(detectionFilePath, 'utf8', (err, rawData) => {
    if (err) {
      console.error('Error reading detection file:', err);
      return res.status(500).json({
        error: 'Failed to read detection data',
        message: err.message
      });
    }

    try {
      const parsedData = JSON.parse(rawData);
      // Calculate transparent rule-based risk indicator from detection data
      const riskAssessment = calculateRisk(parsedData);

      return res.json({
        source: parsedData.source || 'unknown',
        summary: parsedData.summary || {},
        frames_processed: parsedData.frames_processed || 0,
        total_frames_in_video: parsedData.total_frames_in_video || 0,
        risk: riskAssessment,
        frames: parsedData.frames || []
      });
    } catch (parseErr) {
      console.error('Error parsing JSON:', parseErr);
      return res.status(500).json({
        error: 'Corrupted detection data',
        message: 'Detection output file contains invalid JSON.'
      });
    }
  });
});

// GET /api/detections/latest - Get summary, latest frame, and current risk score
app.get('/api/detections/latest', (req, res) => {
  if (!fs.existsSync(detectionFilePath)) {
    return res.status(404).json({
      error: 'Detection data not found',
      message: 'Run the AI detection script to generate latest detections.'
    });
  }

  fs.readFile(detectionFilePath, 'utf8', (err, rawData) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read detection data' });
    }

    try {
      const data = JSON.parse(rawData);
      const frames = data.frames || [];
      const latestFrame = frames.length > 0 ? frames[frames.length - 1] : null;
      const riskAssessment = calculateRisk(data);

      res.json({
        timestamp: new Date().toISOString(),
        summary: data.summary || {},
        latest_frame: latestFrame,
        risk: riskAssessment
      });
    } catch (parseErr) {
      res.status(500).json({ error: 'Failed to parse detection data' });
    }
  });
});

// GET /api/risk - Direct endpoint returning current rule-based risk assessment
app.get('/api/risk', (req, res) => {
  if (!fs.existsSync(detectionFilePath)) {
    return res.json({
      score: 42,
      category: 'Medium',
      details: {
        model_type: 'Rule-Based Fallback (Default Placeholder)',
        note: 'Detection file not yet present on disk.'
      }
    });
  }

  fs.readFile(detectionFilePath, 'utf8', (err, rawData) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read detection data' });
    }
    try {
      const data = JSON.parse(rawData);
      const riskAssessment = calculateRisk(data);
      res.json(riskAssessment);
    } catch (parseErr) {
      res.status(500).json({ error: 'Failed to evaluate risk data' });
    }
  });
});

// GET /api/zones
// Returns Hyderabad zone coordinates with per-zone risk scores derived from
// the global detection risk score. Weights are static config (see HYDERABAD_ZONES).
app.get('/api/zones', (req, res) => {
  const readAndRespond = (globalScore) => {
    const zones = HYDERABAD_ZONES.map(z => {
      const rawZoneScore = Math.round(globalScore * z.weight);
      const zoneScore = Math.min(Math.max(rawZoneScore, 0), 100);
      const { getRiskCategory } = require('./utils/riskCalculator');
      const category = getRiskCategory(zoneScore);
      return {
        id:       z.id,
        name:     z.name,
        lat:      z.lat,
        lon:      z.lon,
        score:    zoneScore,
        category: category,
        color:    riskColor(zoneScore),
        // Clearly label as synthesised
        data_note: 'Score derived from global detection risk × zone weight. Not a real sensor reading.'
      };
    });
    res.json({ zones, generated_at: new Date().toISOString() });
  };

  if (!fs.existsSync(detectionFilePath)) {
    // No detection data yet — return default mid-range score for all zones
    return readAndRespond(42);
  }

  fs.readFile(detectionFilePath, 'utf8', (err, rawData) => {
    if (err) return readAndRespond(42);
    try {
      const data = JSON.parse(rawData);
      const risk = calculateRisk(data);
      readAndRespond(risk.score);
    } catch {
      readAndRespond(42);
    }
  });
});

// GET /api/incidents
// Projects detection frames with high vehicle counts as "incident events".
// Incidents are derived from the detection output — frames where vehicle_count
// exceeds the INCIDENT_THRESHOLD are flagged. Zone names are assigned in a
// round-robin pattern across zones; this is a demo heuristic only.
app.get('/api/incidents', (req, res) => {
  const INCIDENT_THRESHOLD = 10; // vehicles per frame

  if (!fs.existsSync(detectionFilePath)) {
    return res.json({ incidents: [], note: 'No detection data available. Run the AI service first.' });
  }

  fs.readFile(detectionFilePath, 'utf8', (err, rawData) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read detection data' });
    }
    try {
      const data = JSON.parse(rawData);
      const frames = data.frames || [];
      const risk = calculateRisk(data);

      // Build incident list from frames that exceed the density threshold
      const incidents = [];
      frames.forEach((frame, idx) => {
        if (frame.vehicle_count >= INCIDENT_THRESHOLD) {
          const zone = HYDERABAD_ZONES[idx % HYDERABAD_ZONES.length];
          // Derive severity from the per-zone adjusted score
          const rawZoneScore = Math.min(Math.round(risk.score * zone.weight), 100);
          const { getRiskCategory } = require('./utils/riskCalculator');
          const severity = getRiskCategory(rawZoneScore);

          incidents.push({
            id:             `INC-${String(incidents.length + 1).padStart(3, '0')}`,
            frame_index:    frame.frame_index,
            timestamp_sec:  frame.timestamp_sec,
            vehicle_count:  frame.vehicle_count,
            zone_id:        zone.id,
            zone_name:      zone.name,
            severity:       severity,
            score:          rawZoneScore,
            color:          riskColor(rawZoneScore),
            data_note:      'Incident inferred from frame vehicle_count > threshold. Not a verified real event.'
          });
        }
      });

      res.json({
        incidents,
        threshold_used: INCIDENT_THRESHOLD,
        total_frames_checked: frames.length,
        generated_at: new Date().toISOString()
      });
    } catch (parseErr) {
      res.status(500).json({ error: 'Failed to parse detection data' });
    }
  });
});

// GET /api/cameras
// Returns camera feed metadata derived from the detection output file.
// Only one video source exists (the local sample video); it is represented as
// a single camera record.
app.get('/api/cameras', (req, res) => {
  if (!fs.existsSync(detectionFilePath)) {
    return res.json({
      cameras: [],
      note: 'No detection data available. Run the AI service first.'
    });
  }

  fs.readFile(detectionFilePath, 'utf8', (err, rawData) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read detection data' });
    }
    try {
      const data = JSON.parse(rawData);
      const risk = calculateRisk(data);

      const cameras = [{
        id:                'CAM-001',
        name:              'Primary Detection Feed',
        source_file:       data.source || 'unknown',
        status:            'processed',
        frames_processed:  data.frames_processed || 0,
        total_frames:      data.total_frames_in_video || 0,
        processing_time_sec: data.processing_time_sec || 0,
        summary: {
          total_detections:    data.summary?.total_vehicle_detections || 0,
          avg_per_frame:       data.summary?.avg_vehicles_per_frame || 0,
          peak_count:          data.summary?.peak_vehicles_in_frame || 0,
          by_class:            data.summary?.by_class || {}
        },
        current_risk: {
          score:    risk.score,
          category: risk.category,
          color:    riskColor(risk.score)
        },
        last_processed: new Date().toISOString(),
        data_note: 'Single local video source processed by the AI service. Not a live camera stream.'
      }];

      res.json({ cameras, generated_at: new Date().toISOString() });
    } catch (parseErr) {
      res.status(500).json({ error: 'Failed to parse detection data' });
    }
  });
});

// ─── Start Server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Traffic Backend API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Detections:   http://localhost:${PORT}/api/detections`);
  console.log(`Risk assess:  http://localhost:${PORT}/api/risk`);
  console.log(`Zones:        http://localhost:${PORT}/api/zones`);
  console.log(`Incidents:    http://localhost:${PORT}/api/incidents`);
  console.log(`Cameras:      http://localhost:${PORT}/api/cameras`);
  console.log(`Reading from: ${detectionFilePath}`);
  console.log(`==================================================`);
});
