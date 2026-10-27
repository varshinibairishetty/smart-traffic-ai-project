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
      risk: 'GET /api/risk'
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

// ─── Start Server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Traffic Backend API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Detections:   http://localhost:${PORT}/api/detections`);
  console.log(`Risk assess:  http://localhost:${PORT}/api/risk`);
  console.log(`Reading from: ${detectionFilePath}`);
  console.log(`==================================================`);
});
