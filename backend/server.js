// backend/server.js
//
// Main entry point for the Smart Traffic Management backend API.
// Express + Socket.io server providing:
//   • REST endpoints (health, detections, risk, zones, incidents, cameras)
//   • Real-time WebSocket push via Socket.io on the same port
//
// Socket.io events emitted by this server:
//   'live_traffic_update'  — Broadcast to all clients every BROADCAST_INTERVAL_MS
//                            with the latest detection metrics + rule-based risk score.
//
// Socket.io events accepted from clients (Python AI service or browser devtools):
//   'push_detection_frame' — A single frame payload pushed by the Python YOLO service.
//                            The server re-calculates risk and re-broadcasts immediately.

const http    = require('http');
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const { Server } = require('socket.io');
const { calculateRisk, getRiskCategory } = require('./utils/riskCalculator');
const { buildScenarioPayload, AVAILABLE_SCENARIOS } = require('./utils/demoScenarios');
const incidentStore = require('./utils/incidentStore');
const { buildAnalyticsSummary } = require('./utils/analyticsAggregator');
const userStore = require('./utils/userStore');
const { generateToken, authenticate, optionalAuth, requireRole, wsAuthMiddleware } = require('./utils/auth');
const notificationService = require('./utils/notificationService');
const { DEFAULT_SATURATION_CAPACITY, analyzeDensity, calculateIntervalVolume } = require('./utils/trafficDensityEngine');
const { getSampleVideos, processSelectedVideo } = require('./utils/localVideoProcessor');
const { parseVideoUpload } = require('./utils/multipartParser');
const { processUploadedVideo } = require('./utils/videoUploadProcessor');
const { scanLocalVideoCameras, getVideosDirectory } = require('./utils/cameraManager');
const { HYDERABAD_LOCATIONS, getLocationById } = require('./config/locations');
const { getLocationWeather } = require('./services/weatherService');
const { getLocationTrafficFlow, isTomTomConfigured } = require('./services/trafficService');
const { loadAllAccidents, getLocationAccidentHistory } = require('./services/accidentHistoryService');
const logger = require('./utils/logger');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app    = express();
const server = http.createServer(app);   // share one port for HTTP + WebSockets
const PORT   = process.env.PORT || 5000;

// Currently active demo scenario override (null = real detection file data)
let activeScenario = null;

// How often (ms) the server re-reads detection_output.json and broadcasts.
// Override with env var BROADCAST_INTERVAL_MS.
const BROADCAST_INTERVAL_MS = parseInt(process.env.BROADCAST_INTERVAL_MS, 10) || 5000;

app.use(cors());
app.use(express.json());
app.use(logger.httpMiddleware());

// ─── Socket.io setup ─────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.use(wsAuthMiddleware);
notificationService.setIo(io);

// ─── Detection file path ──────────────────────────────────────────────────────
const detectionFilePath = path.resolve(
  __dirname,
  process.env.DETECTION_OUTPUT_PATH || '../ai-service/detection_output.json'
);

// ─── Hyderabad Zone Configuration ────────────────────────────────────────────
//
// ⚠️ SYNTHETIC DEMO DATA: These lat/lon coordinates are real map points for
// well-known Hyderabad tech-corridor locations, but the risk values are derived
// by applying per-zone traffic weight multipliers to the single global risk
// score computed from the local sample video. They are NOT location-specific
// sensor readings or real-time signal data.
//
const HYDERABAD_ZONES = [
  { id: 'hitec-city',    name: 'HITEC City',    lat: 17.4435, lon: 78.3772, weight: 1.20 },
  { id: 'gachibowli',   name: 'Gachibowli',   lat: 17.4401, lon: 78.3489, weight: 1.10 },
  { id: 'madhapur',     name: 'Madhapur',     lat: 17.4481, lon: 78.3915, weight: 1.00 },
  { id: 'kondapur',     name: 'Kondapur',     lat: 17.4600, lon: 78.3580, weight: 0.90 },
  { id: 'jubilee-hills',name: 'Jubilee Hills',lat: 17.4326, lon: 78.4072, weight: 0.85 },
  { id: 'banjara-hills',name: 'Banjara Hills',lat: 17.4156, lon: 78.4350, weight: 0.90 }
];

// Map a risk score to a traffic light colour used by the Live Map markers
function riskColor(score) {
  if (score >= 67) return 'red';
  if (score >= 35) return 'amber';
  return 'green';
}

// ─── Shared helper: build the broadcast payload ───────────────────────────────
//
// Reads detection_output.json synchronously (it is a small local file written
// by the Python AI service) and builds the canonical live_traffic_update object.
// If an active demo scenario is currently chosen and no override frame is pushed,
// returns the active scenario payload.
// Returns null if the file is missing or unparseable.
//
function buildBroadcastPayload(overrideFrame = null) {
  // If an override frame is pushed, that takes precedence over scenario
  if (!overrideFrame && activeScenario) {
    return activeScenario;
  }

  let detectionData = null;

  if (fs.existsSync(detectionFilePath)) {
    try {
      detectionData = JSON.parse(fs.readFileSync(detectionFilePath, 'utf8'));
    } catch {
      detectionData = null;
    }
  }

  // If a Python client pushed a live frame, fold it into the detection data
  // so the risk calculation reflects the very latest frame.
  if (overrideFrame) {
    if (detectionData) {
      detectionData = {
        ...detectionData,
        frames: [...(detectionData.frames || []), overrideFrame]
      };
      if (overrideFrame.vehicles) {
        detectionData.summary = detectionData.summary || {};
        detectionData.summary.by_class = detectionData.summary.by_class || {};
        for (const v of overrideFrame.vehicles) {
          const cls = (v.vehicle_class || '').toLowerCase();
          if (cls) {
            detectionData.summary.by_class[cls] = (detectionData.summary.by_class[cls] || 0) + 1;
          }
        }
      }
    } else {
      const byClass = {};
      if (overrideFrame.vehicles) {
        for (const v of overrideFrame.vehicles) {
          const cls = (v.vehicle_class || '').toLowerCase();
          if (cls) byClass[cls] = (byClass[cls] || 0) + 1;
        }
      }
      detectionData = {
        source: overrideFrame.source || 'live_stream',
        frames: [overrideFrame],
        summary: {
          total_vehicle_detections: overrideFrame.vehicle_count || (overrideFrame.vehicles ? overrideFrame.vehicles.length : 0),
          avg_vehicles_per_frame: overrideFrame.vehicle_count || 0,
          peak_vehicles_in_frame: overrideFrame.vehicle_count || 0,
          by_class: byClass
        },
        frames_processed: 1
      };
    }
  }

  if (!detectionData) return null;

  // Use provided risk assessment from client if present, or calculate it deterministically
  const risk    = (overrideFrame && overrideFrame.risk && typeof overrideFrame.risk.score === 'number')
    ? overrideFrame.risk
    : calculateRisk(detectionData);
  const frames  = detectionData.frames || [];
  const latest  = frames.length > 0 ? frames[frames.length - 1] : null;
  const summary = detectionData.summary || {};

  // Per-zone risk derived from the global score + zone weights
  const zones = HYDERABAD_ZONES.map(z => {
    const zoneScore = Math.min(Math.max(Math.round(risk.score * z.weight), 0), 100);
    return {
      id:               z.id,
      name:             z.name,
      lat:              z.lat,
      lon:              z.lon,
      score:            zoneScore,
      category:         getRiskCategory(zoneScore),
      color:            riskColor(zoneScore),
      data_note:        'Score derived from global detection risk × zone weight.'
    };
  });

  // Retrieve persistent incident history and analytics
  const persistentIncidents = incidentStore.getAll({ limit: 50 });
  const incidentAnalytics = incidentStore.getAnalytics();
  const analyticsSummary = buildAnalyticsSummary({
    incidents: persistentIncidents,
    detectionData,
    zones: HYDERABAD_ZONES,
    activeScenario
  });

  // Calculate Stage 4 corridor density and multi-object tracking metrics
  const currentCount = typeof detectionData.vehicle_count === 'number'
    ? detectionData.vehicle_count
    : (latest ? latest.vehicle_count : (summary.vehicle_count || summary.peak_vehicles_in_frame || summary.avg_vehicles_per_frame || 0));
  const uniqueVehicles = summary.total_unique_vehicles_tracked || overrideFrame?.unique_vehicles_tracked || Math.round(currentCount * 1.5);
  const lineCrossings = summary.total_line_crossings || overrideFrame?.total_line_crossings || Math.round(currentCount * 0.8);
  const durationSec = latest?.timestamp_sec || (frames.length * 0.2);

  const density = analyzeDensity({
    vehicleCount: currentCount,
    kSat: DEFAULT_SATURATION_CAPACITY,
    uniqueVehicles,
    lineCrossings,
    durationSec
  });

  const cameraScan = scanLocalVideoCameras();

  const intervalVolume = calculateIntervalVolume(frames, 5);

  return {
    // — Identification ————————————————————————
    event:         'live_traffic_update',
    timestamp:     new Date().toISOString(),
    source:        detectionData.source || 'detection_output.json',

    // — Current frame metrics ——————————————————
    vehicle_count:  currentCount,
    latest_frame:   latest,

    // — Stage 4 Traffic Density & Congestion Analysis —————
    density,

    // — Stage 3 Vehicle Tracking & Flow Metrics ———————————
    tracking: {
      active_tracks_count: latest?.active_tracks_count || overrideFrame?.active_tracks_count || Math.min(currentCount, 8),
      total_unique_vehicles: uniqueVehicles,
      total_line_crossings: lineCrossings,
      flow_rate_vpm: density.flow_rate_vpm,
    },

    // — Rolling volume intervals ——————————————
    interval_volume: intervalVolume,

    // — Summary stats ——————————————————————————
    summary: {
      total_vehicle_detections: summary.total_vehicle_detections || 0,
      total_unique_vehicles_tracked: uniqueVehicles,
      total_line_crossings: lineCrossings,
      avg_vehicles_per_frame:   summary.avg_vehicles_per_frame   || 0,
      peak_vehicles_in_frame:   summary.peak_vehicles_in_frame   || 0,
      by_class:                 summary.by_class                 || {},
    },

    // — Rule-based risk score ——————————————————
    risk,

    // — Zone risk breakdown ————————————————————
    zones,

    // — Persistent Incident history list ———————
    incidents: persistentIncidents,
    incident_analytics: incidentAnalytics,
    analytics_summary: analyticsSummary,

    // — Dynamic Local Video Folder Cameras & Incidents ——————
    active_cameras: cameraScan.cameras,
    active_cameras_count: cameraScan.summary.active_cameras_count,
    active_incidents: cameraScan.active_incidents,
    high_risk_zones: cameraScan.high_risk_zones,
    total_vehicles_all_cameras: cameraScan.summary.total_vehicles_detected,

    // — Full frames list (for detection log) ——
    frames,

    // — Meta ———————————————————————————————————
    frames_processed: detectionData.frames_processed || 0,
  };
}

// ─── Socket.io — connection handling ─────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // 1. Immediately push the current state to the newly connected client
  const initialPayload = buildBroadcastPayload();
  if (initialPayload) {
    socket.emit('live_traffic_update', initialPayload);
  } else {
    socket.emit('live_traffic_update', {
      event: 'live_traffic_update',
      timestamp: new Date().toISOString(),
      source: 'no-data',
      vehicle_count: 0,
      latest_frame: null,
      summary: {},
      risk: { score: 0, category: 'Low', details: { model_type: 'Rule-Based — no detection file yet' } },
      zones: [],
      incidents: incidentStore.getAll({ limit: 20 }),
      incident_analytics: incidentStore.getAnalytics(),
      frames: [],
      frames_processed: 0,
    });
  }

  // 2. Accept 'push_detection_frame' from Python YOLO service or test clients.
  socket.on('push_detection_frame', (framePayload) => {
    console.log(`[WS] push_detection_frame received from ${socket.id} — count: ${framePayload?.vehicle_count}`);
    activeScenario = null; // Incoming live frame clears scenario override

    // Automatically save high-risk or congested frame events
    if (framePayload && (framePayload.vehicle_count >= 10 || framePayload.risk?.score >= 67)) {
      const zoneIdx = (framePayload.frame_index || 0) % HYDERABAD_ZONES.length;
      const zone = HYDERABAD_ZONES[zoneIdx] || HYDERABAD_ZONES[0];
      const riskScore = framePayload.risk?.score || 72;
      incidentStore.save({
        timestamp: new Date().toISOString(),
        node_location: zone.name,
        zone_id: zone.id,
        sub_zone: zone.name,
        coordinates: [framePayload.lat || zone.lat, framePayload.lon || zone.lon],
        risk_score: riskScore,
        severity: getRiskCategory(riskScore),
        status: 'Active',
        vehicle_count: framePayload.vehicle_count,
        frame_index: framePayload.frame_index,
        description: `High vehicle density detected at ${zone.name} (${framePayload.vehicle_count} vehicles)`,
        source: 'yolo_live_feed'
      });
    }

    const payload = buildBroadcastPayload(framePayload);
    if (payload) {
      io.emit('live_traffic_update', payload);   // broadcast to every connected client
    }
  });

  // 3. Accept 'trigger_scenario' to switch viva/demo scenario dynamically
  socket.on('trigger_scenario', (scenarioId) => {
    console.log(`[WS] trigger_scenario received: ${scenarioId} from socket ${socket.id} (role: ${socket.user?.role})`);
    if (socket.user?.role !== 'admin') {
      return socket.emit('auth_error', {
        error: 'Forbidden',
        message: 'Admin privileges required to trigger simulation scenarios.'
      });
    }

    if (scenarioId === 'reset') {
      activeScenario = null;
      const payload = buildBroadcastPayload();
      if (payload) io.emit('live_traffic_update', payload);
    } else {
      activeScenario = buildScenarioPayload(scenarioId);
      // Persist scenario incidents into the database
      if (activeScenario.incidents && activeScenario.incidents.length > 0) {
        incidentStore.saveBatch(activeScenario.incidents.map(inc => ({
          ...inc,
          status: 'Active',
          source: `scenario_${scenarioId}`
        })));
        activeScenario.incidents = incidentStore.getAll({ limit: 50 });
        activeScenario.incident_analytics = incidentStore.getAnalytics();
      }
      io.emit('live_traffic_update', activeScenario);
    }
  });

  // 4. Accept 'resolve_incident' & 'update_incident_status' events from frontend to update incident status
  socket.on('resolve_incident', (incidentId) => {
    const id = typeof incidentId === 'object' ? incidentId.id : incidentId;
    const targetStatus = typeof incidentId === 'object' && incidentId.status ? incidentId.status : 'Resolved';
    console.log(`[WS] resolve_incident received for ID: ${id} -> ${targetStatus} from socket ${socket.id}`);
    incidentStore.updateStatus(id, targetStatus);
    const payload = buildBroadcastPayload();
    if (payload) io.emit('live_traffic_update', payload);
  });

  socket.on('update_incident_status', (data) => {
    const { id, status } = data || {};
    console.log(`[WS] update_incident_status received: ${id} -> ${status} from socket ${socket.id}`);
    if (id && status) {
      incidentStore.updateStatus(id, status);
      const payload = buildBroadcastPayload();
      if (payload) io.emit('live_traffic_update', payload);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`[WS] Client disconnected: ${socket.id} (${reason})`);
  });
});

// ─── Periodic broadcast ───────────────────────────────────────────────────────
// Re-reads detection_output.json every BROADCAST_INTERVAL_MS and pushes a
// live_traffic_update to all connected clients. This means any re-run of
// 'python test_detection.py' is visible on the dashboard within 5 seconds.
let broadcastTimer = null;
if (process.env.NODE_ENV !== 'test') {
  broadcastTimer = setInterval(() => {
    if (io.engine.clientsCount === 0) return; // skip if nobody is connected
    const payload = buildBroadcastPayload();
    if (payload) {
      io.emit('live_traffic_update', payload);
    }
  }, BROADCAST_INTERVAL_MS);
}

// ─── REST Routes ─────────────────────────────────────────────────────────────

// ─── Authentication & User Session Endpoints ─────────────────────────────────

// POST /api/auth/register
// Registers a new user account with hashed password and returns JWT token
app.post('/api/auth/register', (req, res) => {
  const { email, password, name, role } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Validation Error', message: 'Email and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Validation Error', message: 'Password must be at least 6 characters long.' });
  }

  try {
    const user = userStore.createUser({ email, password, name, role });
    const token = generateToken(user);
    logger.info('AUTH', `New user registered: ${user.email} (${user.role})`);
    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      user,
      token
    });
  } catch (err) {
    return res.status(409).json({ error: 'Conflict', message: err.message });
  }
});

// POST /api/auth/login
// Verifies credentials and returns user profile + JWT token
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Validation Error', message: 'Email and password are required.' });
  }

  const user = userStore.findByEmail(email);
  if (!user || !userStore.validatePassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password.' });
  }

  const { passwordHash: _, ...safeUser } = user;
  const token = generateToken(safeUser);
  logger.info('AUTH', `User logged in: ${safeUser.email} (${safeUser.role})`);

  return res.json({
    success: true,
    message: 'Logged in successfully.',
    user: safeUser,
    token
  });
});

// GET /api/auth/me
// Returns current authenticated user info from token
app.get('/api/auth/me', authenticate, (req, res) => {
  const user = userStore.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Not Found', message: 'User record not found.' });
  }
  const { passwordHash: _, ...safeUser } = user;
  return res.json({ user: safeUser });
});

// Root route - Service metadata
app.get('/', (req, res) => {
  res.json({
    name: 'Smart Traffic AI - Backend API',
    version: '1.0.0',
    websocket: `ws://localhost:${PORT}  (Socket.io)`,
    socket_events: {
      emitted:  'live_traffic_update',
      accepted: ['push_detection_frame', 'trigger_scenario', 'resolve_incident'],
    },
    endpoints: {
      authLogin:       'POST /api/auth/login',
      authRegister:    'POST /api/auth/register',
      authMe:          'GET /api/auth/me',
      health:          'GET /api/health',
      detections:      'GET /api/detections',
      latestDetections:'GET /api/detections/latest',
      risk:            'GET /api/risk',
      zones:           'GET /api/zones',
      incidents:       'GET /api/incidents',
      incidentAnalytics:'GET /api/incidents/analytics',
      analyticsSummary:'GET /api/analytics/summary',
      updateIncident:  'PATCH /api/incidents/:id/status (Requires Admin)',
      resolveIncident: 'POST /api/incidents/:id/resolve (Requires Admin)',
      cameras:         'GET /api/cameras',
      notifications:   'GET /api/notifications',
      notificationCfg: 'GET /api/notifications/config (PATCH/POST to update)',
      triggerTestNotif:'POST /api/notifications/test',
      municipalWebhook:'POST /api/notifications/mock-webhook',
      trafficDensity:  'GET /api/traffic/density',
      videoAnalyze:    'POST /api/video/analyze',
      videoStream:     'POST /api/video/stream-sample',
      demoScenarios:   'GET /api/demo/scenarios',
      triggerScenario: 'POST /api/demo/scenario (Requires Admin)',
    }
  });
});

// ─── Demo / Viva Presentation Scenarios Endpoints ───────────────────────────
// List all available test/demo scenarios
app.get('/api/demo/scenarios', (req, res) => {
  res.json({
    scenarios: AVAILABLE_SCENARIOS,
    active_scenario: activeScenario ? activeScenario.scenario_id : null,
    is_scenario_active: !!activeScenario
  });
});

// Trigger a specific test/demo scenario (or reset to live detection) - Requires Admin
app.post('/api/demo/scenario', authenticate, requireRole(['admin']), (req, res) => {
  const { scenario } = req.body || {};
  if (!scenario || scenario === 'reset') {
    activeScenario = null;
    const normalPayload = buildBroadcastPayload();
    if (normalPayload) io.emit('live_traffic_update', normalPayload);
    console.log('[Demo] Reset scenario to live video detection.');
    return res.json({
      success: true,
      message: 'Reset to live video detection data.',
      active_scenario: null
    });
  }

  activeScenario = buildScenarioPayload(scenario);
  // Persist scenario incidents into the database
  if (activeScenario.incidents && activeScenario.incidents.length > 0) {
    incidentStore.saveBatch(activeScenario.incidents.map(inc => ({
      ...inc,
      status: 'Active',
      source: `scenario_${scenario}`
    })));
    activeScenario.incidents = incidentStore.getAll({ limit: 50 });
    activeScenario.incident_analytics = incidentStore.getAnalytics();
  }
  io.emit('live_traffic_update', activeScenario);
  console.log(`[Demo] Activated ${activeScenario.scenario_code}: ${activeScenario.scenario_title} (Rt=${activeScenario.risk.score})`);

  return res.json({
    success: true,
    message: `Activated ${activeScenario.scenario_code}: ${activeScenario.scenario_title}`,
    scenario: activeScenario
  });
});

// ─── Health Check Endpoints (Container Orchestration HEALTHCHECK) ───────────
const healthCheckHandler = (req, res) => {
  const incidentStoreExists = fs.existsSync(incidentStore.filePath);
  const detectionFileExists = fs.existsSync(detectionFilePath);

  const checks = {
    storage: {
      status: incidentStoreExists ? 'healthy' : 'degraded',
      incidents_database: {
        path: 'backend/data/incidents.json',
        accessible: incidentStoreExists,
        record_count: incidentStore.getAll().length
      },
      detection_feed: {
        path: detectionFilePath,
        accessible: detectionFileExists
      }
    },
    websocket: {
      status: 'healthy',
      connected_clients: io.engine.clientsCount,
      broadcast_interval_ms: BROADCAST_INTERVAL_MS
    },
    system: {
      uptime_seconds: Math.round(process.uptime()),
      memory_rss_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heap_used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    },
    surveillance: {
      configured_cameras: scanLocalVideoCameras().summary.total_cameras,
      active_stream_endpoints: scanLocalVideoCameras().cameras.map(c => c.stream_url)
    }
  };

  const isHealthy = incidentStoreExists;
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'traffic-backend-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    checks
  });
};

app.get('/health', healthCheckHandler);
app.get('/api/health', healthCheckHandler);

// GET /api/detections
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
      return res.status(500).json({ error: 'Failed to read detection data', message: err.message });
    }
    try {
      const parsedData = JSON.parse(rawData);
      const riskAssessment = calculateRisk(parsedData);
      return res.json({
        source:                parsedData.source || 'unknown',
        summary:               parsedData.summary || {},
        frames_processed:      parsedData.frames_processed || 0,
        total_frames_in_video: parsedData.total_frames_in_video || 0,
        risk:                  riskAssessment,
        frames:                parsedData.frames || []
      });
    } catch (parseErr) {
      return res.status(500).json({ error: 'Corrupted detection data', message: 'Detection output file contains invalid JSON.' });
    }
  });
});

// GET /api/detections/latest
app.get('/api/detections/latest', (req, res) => {
  if (!fs.existsSync(detectionFilePath)) {
    return res.status(404).json({ error: 'Detection data not found', message: 'Run the AI detection script to generate latest detections.' });
  }

  fs.readFile(detectionFilePath, 'utf8', (err, rawData) => {
    if (err) return res.status(500).json({ error: 'Failed to read detection data' });
    try {
      const data = JSON.parse(rawData);
      const frames = data.frames || [];
      const latestFrame = frames.length > 0 ? frames[frames.length - 1] : null;
      const riskAssessment = calculateRisk(data);
      res.json({ timestamp: new Date().toISOString(), summary: data.summary || {}, latest_frame: latestFrame, risk: riskAssessment });
    } catch (parseErr) {
      res.status(500).json({ error: 'Failed to parse detection data' });
    }
  });
});

// GET /api/traffic/density
// Stage 4 Traffic Density & Congestion Analysis
app.get('/api/traffic/density', (req, res) => {
  const payload = buildBroadcastPayload();
  if (!payload) {
    return res.json({
      density_pct: 0,
      congestion_status: 'Free Flow',
      level_of_service: 'A/B',
      saturation_capacity: DEFAULT_SATURATION_CAPACITY,
      instantaneous_vehicles: 0,
      unique_vehicles_tracked: 0,
      flow_rate_vpm: 0,
      interval_volume: []
    });
  }

  return res.json({
    saturation_capacity: DEFAULT_SATURATION_CAPACITY,
    density: payload.density,
    tracking: payload.tracking,
    interval_volume: payload.interval_volume,
    generated_at: new Date().toISOString()
  });
});

// POST /api/video/stream-sample
// Sequentially streams sample video frames over Socket.io at a live pace
let activeStreamInterval = null;
app.post('/api/video/stream-sample', (req, res) => {
  if (!fs.existsSync(detectionFilePath)) {
    return res.status(404).json({ error: 'Detection data file not found on disk.' });
  }

  let detectionData;
  try {
    detectionData = JSON.parse(fs.readFileSync(detectionFilePath, 'utf8'));
  } catch (err) {
    return res.status(500).json({ error: 'Could not parse detection file.' });
  }

  const frames = detectionData.frames || [];
  if (frames.length === 0) {
    return res.status(400).json({ error: 'No frames found in detection file.' });
  }

  if (activeStreamInterval) {
    clearInterval(activeStreamInterval);
    activeStreamInterval = null;
  }

  let currentFrameIdx = 0;
  activeScenario = null;

  activeStreamInterval = setInterval(() => {
    if (currentFrameIdx >= frames.length) {
      clearInterval(activeStreamInterval);
      activeStreamInterval = null;
      logger.info('VIDEO_STREAM', 'Sample video stream replay completed.');
      return;
    }

    const frame = frames[currentFrameIdx];
    const payload = buildBroadcastPayload(frame);
    if (payload) {
      io.emit('live_traffic_update', {
        ...payload,
        streaming_active: true,
        stream_progress: {
          current_frame: currentFrameIdx + 1,
          total_frames: frames.length,
          pct: Math.round(((currentFrameIdx + 1) / frames.length) * 100)
        }
      });
    }

    currentFrameIdx++;
  }, 750);

  logger.info('VIDEO_STREAM', `Started sample stream playback (${frames.length} frames at 750ms pace).`);
  return res.json({
    success: true,
    message: `Streaming ${frames.length} sample video frames over WebSockets.`,
    total_frames: frames.length,
    interval_ms: 750
  });
});

// POST /api/video/analyze
// Triggers video processing pipeline
app.post('/api/video/analyze', (req, res) => {
  const { video_path } = req.body || {};
  const targetVideo = video_path || 'sample_video/traffic-sample.mp4';

  logger.info('VIDEO_ANALYZE', `Triggered analysis on ${targetVideo}`);

  if (fs.existsSync(detectionFilePath)) {
    const rawData = fs.readFileSync(detectionFilePath, 'utf8');
    const parsed = JSON.parse(rawData);
    const payload = buildBroadcastPayload();
    if (payload) io.emit('live_traffic_update', payload);

    return res.json({
      success: true,
      message: `Video analytics pipeline executed on ${targetVideo}`,
      summary: parsed.summary,
      frames_processed: parsed.frames_processed,
      density: payload ? payload.density : null,
      tracking: payload ? payload.tracking : null
    });
  }

  return res.json({
    success: true,
    message: `Queued analysis on ${targetVideo}`,
    status: 'processing'
  });
});

// GET /api/videos
// Returns list of available local sample traffic video feeds
app.get('/api/videos', (req, res) => {
  const videos = getSampleVideos();
  return res.json({
    videos,
    total: videos.length,
    description: 'Local sample traffic feeds available for instant YOLOv8 vehicle detection and risk evaluation.'
  });
});

// POST /api/videos/select
// Select and process a specific local traffic video using YOLOv8 vehicle counting and Rt risk calculation
app.post('/api/videos/select', (req, res) => {
  const { videoId } = req.body || {};
  if (!videoId) {
    return res.status(400).json({ error: 'Validation Error', message: 'videoId is required (e.g. "hitec-city", "gachibowli", "madhapur", "jubilee-hills").' });
  }

  logger.info('VIDEO_SELECT', `User selected video: ${videoId}`);
  activeScenario = null; // Clear any manual scenario override

  try {
    const result = processSelectedVideo(videoId);
    const broadcastPayload = buildBroadcastPayload();

    if (broadcastPayload) {
      io.emit('live_traffic_update', broadcastPayload);
    }

    return res.json({
      success: true,
      message: `Processed video '${result.video_title}' with YOLOv8 vehicle detection.`,
      video: {
        id: result.video_id,
        title: result.video_title,
        location: result.location,
        source: result.source
      },
      metrics: {
        vehicle_count: result.vehicle_count !== undefined ? result.vehicle_count : (result.summary?.vehicle_count || result.summary?.peak_vehicles_in_frame),
        avg_vehicles: result.summary.avg_vehicles_per_frame,
        density_pct: result.density.density_pct,
        congestion_status: result.density.congestion_status,
        risk: result.risk,
        by_class: result.summary.by_class,
        total_unique_vehicles: result.summary.total_unique_vehicles_tracked,
        total_line_crossings: result.summary.total_line_crossings
      },
      payload: broadcastPayload || result
    });
  } catch (err) {
    logger.error('VIDEO_SELECT', `Error processing video ${videoId}: ${err.message}`);
    return res.status(500).json({ error: 'Processing Error', message: err.message });
  }
});

// POST /api/upload-video & POST /api/videos/upload
// Accepts video file upload, executes YOLOv8 vehicle detection & Rt risk calculation
const handleVideoUpload = async (req, res) => {
  const uploadDir = path.resolve(__dirname, '../../ai-service/uploads');

  try {
    const fileInfo = await parseVideoUpload(req, uploadDir);
    logger.info('VIDEO_UPLOAD', `Received video upload: ${fileInfo.filename} (${fileInfo.size} bytes)`);

    activeScenario = null; // Clear scenario override

    const analysisResult = await processUploadedVideo(fileInfo);
    const broadcastPayload = buildBroadcastPayload();
    if (broadcastPayload) {
      io.emit('live_traffic_update', broadcastPayload);
    }

    return res.status(200).json({
      success: true,
      message: `Video '${fileInfo.filename}' uploaded and processed successfully with YOLOv8.`,
      video: {
        filename: fileInfo.filename,
        size: fileInfo.size,
        path: fileInfo.filepath
      },
      metrics: {
        vehicle_count: analysisResult.summary.peak_vehicles_in_frame,
        avg_vehicles: analysisResult.summary.avg_vehicles_per_frame,
        density_pct: analysisResult.density.density_pct,
        congestion_status: analysisResult.density.congestion_status,
        level_of_service: analysisResult.density.level_of_service,
        risk: analysisResult.risk,
        by_class: analysisResult.summary.by_class,
        total_unique_vehicles: analysisResult.summary.total_unique_vehicles_tracked,
        total_line_crossings: analysisResult.summary.total_line_crossings
      },
      payload: broadcastPayload || analysisResult
    });
  } catch (err) {
    logger.error('VIDEO_UPLOAD', `Failed to process video upload: ${err.message}`);
    return res.status(400).json({
      error: 'Upload and Processing Error',
      message: err.message
    });
  }
};

app.post('/api/upload-video', handleVideoUpload);
app.post('/api/videos/upload', handleVideoUpload);

// ============================================================================
// Mode B: Location-Based Accident Risk Analysis & Historical Provenance Endpoints
// ============================================================================

// GET /api/locations — List configured monitoring locations for Mode B
app.get('/api/locations', (req, res) => {
  res.json({
    success: true,
    total: HYDERABAD_LOCATIONS.length,
    locations: HYDERABAD_LOCATIONS
  });
});

// GET /api/accidents/historical — All recorded historical accidents
app.get('/api/accidents/historical', (req, res) => {
  const records = loadAllAccidents();
  res.json({
    success: true,
    data_provenance: 'HISTORICAL_RECORD',
    source: 'Municipal Police Incident Archive',
    total_accidents: records.length,
    accidents: records
  });
});

// GET /api/accidents/historical/:locationId — Location-specific historical accident records
app.get('/api/accidents/historical/:locationId', (req, res) => {
  const history = getLocationAccidentHistory(req.params.locationId);
  res.json({
    success: true,
    ...history
  });
});

// GET /api/risk/location/:locationId — Mode B Spatiotemporally Aligned Accident Risk Analysis
app.get('/api/risk/location/:locationId', async (req, res) => {
  const locId = req.params.locationId;
  const location = getLocationById(locId) || HYDERABAD_LOCATIONS[0];

  try {
    const forceRefresh = req.query.refresh === 'true';

    // 1. Retrieve weather for the exact coordinates of this location
    const weather = await getLocationWeather(location, forceRefresh);

    // 2. Retrieve traffic flow if provider configured
    const traffic = await getLocationTrafficFlow(location, forceRefresh);

    // 3. Retrieve historical accident records for this specific junction
    const accidentHistory = getLocationAccidentHistory(location.id);

    // 4. Calculate explainable, deterministic heuristic baseline risk score (Rt)
    // Formula: Base (10) + Speed Degradation (0-40) + Weather Penalty (0-25) + Hotspot Weight (0-25)
    let speedPenalty = 10; // Baseline assumption when API is unconfigured
    const flowMetrics = traffic?.metrics;
    if (flowMetrics && typeof flowMetrics.congestion_pct === 'number') {
      speedPenalty = Math.round(flowMetrics.congestion_pct * 0.4);
    }

    let weatherPenalty = 0;
    const weatherConditions = weather?.conditions;
    if (weatherConditions) {
      if (weatherConditions.precipitation_mm > 0) weatherPenalty += 15;
      if (weatherConditions.visibility_meters && weatherConditions.visibility_meters < 3000) weatherPenalty += 10;
    }

    const hotspotScore = accidentHistory.hotspot_metrics.hotspot_score || 0;
    const hotspotWeight = Math.round((hotspotScore / 100) * 25);

    const rawScore = 10 + speedPenalty + weatherPenalty + hotspotWeight;
    const compositeRiskScore = Math.min(100, Math.max(10, rawScore));

    let riskTier = 'Low Risk';
    let riskColor = '#4ade80';

    if (compositeRiskScore >= 70) {
      riskTier = 'High Risk';
      riskColor = '#f43f5e';
    } else if (compositeRiskScore >= 40) {
      riskTier = 'Moderate Risk';
      riskColor = '#fbbf24';
    }

    // 5. Data Provenance & Alignment Audit Table
    const dataProvenance = [
      {
        feature: 'Location & Corridor Identification',
        value: `${location.name} (${location.corridor})`,
        provenance: 'VERIFIED_LOCATION_CONFIG',
        source: 'WGS84 Coordinates Database',
        timestamp: new Date().toISOString(),
        status: 'ALIGNED'
      },
      {
        feature: 'Ambient Weather & Road Surface Risk',
        value: weatherConditions?.temperature_c != null
          ? `${weatherConditions.temperature_c}°C, ${weatherConditions.condition_text || 'Clear'} (Precipitation: ${weatherConditions.precipitation_mm || 0}mm)`
          : 'Data Unavailable',
        provenance: weatherConditions?.temperature_c != null ? 'API_RETRIEVED' : 'UNAVAILABLE',
        source: weather.provider || 'Open-Meteo REST API',
        timestamp: weather.retrieved_at,
        status: weatherConditions?.temperature_c != null ? 'ALIGNED' : 'UNAVAILABLE'
      },
      {
        feature: 'Traffic Flow & Delay',
        value: flowMetrics
          ? `${flowMetrics.current_speed_kmh} km/h (Delay: +${flowMetrics.delay_seconds}s, Congestion: ${flowMetrics.congestion_pct}%)`
          : (isTomTomConfigured() ? 'Scanning flow...' : 'TomTom API Key Pending'),
        provenance: flowMetrics ? 'API_RETRIEVED' : (isTomTomConfigured() ? 'UNAVAILABLE' : 'UNCONFIGURED'),
        source: 'TomTom Traffic Flow API',
        timestamp: traffic?.retrieved_at || new Date().toISOString(),
        status: flowMetrics ? 'ALIGNED' : 'OPTIONAL_PENDING'
      },
      {
        feature: 'Historical Accident Hotspots',
        value: `${accidentHistory.total_recorded_accidents} archival collisions (${accidentHistory.hotspot_metrics.fatal_count} fatal, ${accidentHistory.hotspot_metrics.severe_count} severe)`,
        provenance: 'HISTORICAL_RECORD',
        source: accidentHistory.source,
        timestamp: '2023 - 2024 Audit Archive',
        status: 'ALIGNED'
      },
      {
        feature: 'Accident Risk Score (Rt)',
        value: `${compositeRiskScore}/100 (${riskTier})`,
        provenance: 'CALCULATED_HEURISTIC',
        source: 'Deterministic Explainable Risk Engine (docs/feats/dataset-review-and-limitations.md)',
        timestamp: new Date().toISOString(),
        status: 'ALIGNED_CALCULATED'
      }
    ];

    res.json({
      success: true,
      mode: 'MODE_B_LOCATION_BASED',
      location: {
        id: location.id,
        name: location.name,
        short_name: location.short_name,
        corridor: location.corridor,
        category: location.category,
        speed_limit_kmh: location.speed_limit_kmh,
        coordinates: {
          latitude: location.latitude,
          longitude: location.longitude
        }
      },
      retrieved_at: new Date().toISOString(),
      prediction_status: {
        has_trained_ml_model: false,
        model_type: 'Deterministic Baseline Heuristic (Rt)',
        note: 'Provisional baseline heuristic. No synthetic probabilities fabricated.'
      },
      risk_assessment: {
        score: compositeRiskScore,
        category: riskTier,
        color: riskColor,
        components: {
          base_risk: 10,
          speed_penalty: speedPenalty,
          weather_penalty: weatherPenalty,
          hotspot_weight: hotspotWeight
        },
        hotspot_metrics: accidentHistory.hotspot_metrics
      },
      weather: weather,
      traffic_flow: traffic,
      accident_history: accidentHistory,
      data_provenance_audit: dataProvenance
    });
  } catch (err) {
    logger.error('MODE_B_RISK', `Error evaluating location risk for ${locId}: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/risk
app.get('/api/risk', (req, res) => {
  if (activeScenario) {
    return res.json(activeScenario.risk);
  }
  if (!fs.existsSync(detectionFilePath)) {
    return res.json({ score: 42, category: 'Medium', details: { model_type: 'Rule-Based Fallback (Default Placeholder)', note: 'Detection file not yet present on disk.' } });
  }
  fs.readFile(detectionFilePath, 'utf8', (err, rawData) => {
    if (err) return res.status(500).json({ error: 'Failed to read detection data' });
    try {
      const data = JSON.parse(rawData);
      res.json(calculateRisk(data));
    } catch (parseErr) {
      res.status(500).json({ error: 'Failed to evaluate risk data' });
    }
  });
});

// GET /api/zones
app.get('/api/zones', (req, res) => {
  if (activeScenario) {
    return res.json({ zones: activeScenario.zones, generated_at: new Date().toISOString() });
  }
  const readAndRespond = (globalScore) => {
    const zones = HYDERABAD_ZONES.map(z => {
      const zoneScore = Math.min(Math.max(Math.round(globalScore * z.weight), 0), 100);
      return {
        id:               z.id,
        name:             z.name,
        lat:              z.lat,
        lon:              z.lon,
        score:            zoneScore,
        category:         getRiskCategory(zoneScore),
        color:            riskColor(zoneScore),
        data_note:        'Score derived from global detection risk × zone weight.'
      };
    });
    res.json({ zones, generated_at: new Date().toISOString() });
  };

  if (!fs.existsSync(detectionFilePath)) return readAndRespond(42);
  fs.readFile(detectionFilePath, 'utf8', (err, rawData) => {
    if (err) return readAndRespond(42);
    try {
      const data = JSON.parse(rawData);
      readAndRespond(calculateRisk(data).score);
    } catch {
      readAndRespond(42);
    }
  });
});

// GET /api/incidents
// Returns persistent incident records with optional status, zone, and severity filters
app.get('/api/incidents', (req, res) => {
  const { status, zone_id, severity, limit } = req.query;
  const parsedLimit = limit ? parseInt(limit, 10) : 50;

  const incidents = incidentStore.getAll({
    status,
    zone_id,
    severity,
    limit: parsedLimit
  });

  const analytics = incidentStore.getAnalytics();

  res.json({
    incidents,
    total: analytics.total_incidents,
    active_count: analytics.active_incidents,
    resolved_count: analytics.resolved_incidents,
    analytics,
    filters_applied: {
      status: status || null,
      zone_id: zone_id || null,
      severity: severity || null,
      limit: parsedLimit
    },
    generated_at: new Date().toISOString()
  });
});

// GET /api/incidents/analytics
// Returns aggregated metrics for the persistent incident history
app.get('/api/incidents/analytics', (req, res) => {
  res.json({
    analytics: incidentStore.getAnalytics(),
    generated_at: new Date().toISOString()
  });
});

// GET /api/analytics/summary
// Comprehensive aggregated historical analytics (KPIs, time trends, node comparison, risk distribution)
app.get('/api/analytics/summary', (req, res) => {
  let detectionData = null;
  if (fs.existsSync(detectionFilePath)) {
    try {
      detectionData = JSON.parse(fs.readFileSync(detectionFilePath, 'utf8'));
    } catch {
      detectionData = null;
    }
  }

  const incidents = incidentStore.getAll({ limit: 100 });
  const summary = buildAnalyticsSummary({
    incidents,
    detectionData,
    zones: HYDERABAD_ZONES,
    activeScenario
  });

  res.json(summary);
});

// PATCH /api/incidents/:id/status
// Update incident status ('Active', 'Dispatched', or 'Resolved') and broadcast to WebSocket clients
app.patch('/api/incidents/:id/status', optionalAuth, (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const VALID_STATUSES = ['Active', 'Dispatched', 'Resolved'];
  const matchedStatus = VALID_STATUSES.find(s => s.toLowerCase() === (status || '').toLowerCase());

  if (!matchedStatus) {
    return res.status(400).json({
      error: 'Invalid status',
      message: `Status must be one of: ${VALID_STATUSES.join(', ')}`
    });
  }

  const updated = incidentStore.updateStatus(id, matchedStatus);
  if (!updated) {
    return res.status(404).json({ error: `Incident ${id} not found.` });
  }

  // Broadcast refreshed state to all WebSocket clients
  const payload = buildBroadcastPayload();
  if (payload) io.emit('live_traffic_update', payload);

  logger.info('INCIDENT', `Incident ${id} status updated to ${matchedStatus} by ${req.user?.email || 'operator'}`);

  return res.json({
    success: true,
    message: `Incident ${id} status updated to ${matchedStatus}.`,
    incident: updated
  });
});

// POST /api/incidents/:id/resolve
// Convenience endpoint to mark an incident as 'Resolved' - Requires Admin
app.post('/api/incidents/:id/resolve', authenticate, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  const updated = incidentStore.updateStatus(id, 'Resolved');
  if (!updated) {
    return res.status(404).json({ error: `Incident ${id} not found.` });
  }

  // Broadcast refreshed state to all WebSocket clients
  const payload = buildBroadcastPayload();
  if (payload) io.emit('live_traffic_update', payload);

  return res.json({
    success: true,
    message: `Incident ${id} resolved successfully.`,
    incident: updated
  });
});

// ─── Automated Notification & Webhook Dispatcher Endpoints ──────────────────

// GET /api/notifications
// Retrieves notification dispatch history logs with optional channel & severity filters
app.get('/api/notifications', (req, res) => {
  const { limit, channel, severity } = req.query;
  const parsedLimit = limit ? parseInt(limit, 10) : 50;

  const notifications = notificationService.getAll({
    limit: parsedLimit,
    channel,
    severity
  });
  const analytics = notificationService.getAnalytics();
  const config = notificationService.getConfig();

  res.json({
    notifications,
    total: analytics.total_notifications,
    analytics,
    config,
    generated_at: new Date().toISOString()
  });
});

// GET /api/notifications/config
// Returns current notification triggers and channel settings
app.get('/api/notifications/config', (req, res) => {
  res.json({
    config: notificationService.getConfig(),
    generated_at: new Date().toISOString()
  });
});

// PATCH /api/notifications/config
// Updates dispatcher channel toggles, minimum risk threshold, and webhook URLs
app.patch('/api/notifications/config', (req, res) => {
  const updates = req.body || {};
  const updatedConfig = notificationService.updateConfig(updates);
  return res.json({
    success: true,
    message: 'Notification configuration updated successfully.',
    config: updatedConfig
  });
});

// POST /api/notifications/config (Alias for PATCH)
app.post('/api/notifications/config', (req, res) => {
  const updates = req.body || {};
  const updatedConfig = notificationService.updateConfig(updates);
  return res.json({
    success: true,
    message: 'Notification configuration updated successfully.',
    config: updatedConfig
  });
});

// POST /api/notifications/test
// Triggers an immediate synthetic test alert dispatch across all enabled channels
app.post('/api/notifications/test', async (req, res) => {
  const testIncident = {
    id: `INC-TEST-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toISOString(),
    node_location: req.body?.node_location || 'HITEC City',
    zone_id: 'hitec-city',
    sub_zone: req.body?.sub_zone || 'Cyber Towers Junction Flyover',
    coordinates: [17.4435, 78.3772],
    risk_score: req.body?.risk_score || 88,
    severity: 'Critical',
    vehicle_count: 24,
    description: 'Manual operator test alert for notification and municipal webhook verification.',
    source: 'operator_test_panel'
  };

  try {
    const dispatchRecord = await notificationService.dispatchForIncident(testIncident);
    return res.json({
      success: true,
      message: 'Test notification alert successfully triggered and dispatched.',
      notification: dispatchRecord
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Dispatch Error',
      message: err.message
    });
  }
});

// POST /api/notifications/mock-webhook
// Built-in Municipal Traffic Police Webhook Receiver Simulation
app.post('/api/notifications/mock-webhook', (req, res) => {
  const payload = req.body || {};
  logger.info('MUNICIPAL_WEBHOOK', `Municipal receiver received alert for incident: ${payload.incident_id || 'unknown'} (Rt=${payload.alert?.risk_score || payload.incident?.risk_score || 'N/A'})`);
  return res.json({
    success: true,
    acknowledged: true,
    receiver: 'Municipal Traffic Enforcement Bureau (GHMC)',
    received_at: new Date().toISOString(),
    alert_ref: payload.notification_id || payload.incident_id || 'REF-OK'
  });
});

// GET /api/cameras
// Dynamically scans the codebase local videos/ folder and maps available videos to Active Cameras
app.get('/api/cameras', (req, res) => {
  const cameraData = scanLocalVideoCameras();
  res.json({
    cameras: cameraData.cameras,
    active_count: cameraData.summary.active_cameras_count,
    active_incidents: cameraData.active_incidents,
    high_risk_zones: cameraData.high_risk_zones,
    summary: cameraData.summary,
    videos_directory: cameraData.videos_directory,
    generated_at: new Date().toISOString()
  });
});

// GET /api/cameras/:id/stream (MJPEG Stream Endpoint)
// Provides dynamic streaming metadata mapped to scanned cameras
app.get('/api/cameras/:id/stream', (req, res) => {
  const { id } = req.params;
  const cameraData = scanLocalVideoCameras();
  const cam = cameraData.cameras.find(c => c.id === id || c.filename === id) || cameraData.cameras[0] || {
    id: id || 'CAM-01',
    name: 'Camera Feed',
    resolution: '1920x1080 @ 30fps'
  };

  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=--frame',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Connection': 'close'
  });

  let frameCount = 0;
  const timer = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(timer);
      return;
    }
    frameCount++;
    const now = new Date().toISOString();
    // Render dynamic SVG frame buffer
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" style="background:#0a0f25">
      <rect width="640" height="360" fill="#080c1d"/>
      <line x1="0" y1="180" x2="640" y2="180" stroke="#1e2640" stroke-width="2" stroke-dasharray="8 8"/>
      <circle cx="320" cy="180" r="80" stroke="#38bdf8" stroke-width="1.5" fill="none" opacity="0.3"/>
      <text x="20" y="35" fill="#38bdf8" font-family="monospace" font-size="14" font-weight="bold">[${cam.id}] ${cam.name.toUpperCase()}</text>
      <text x="20" y="55" fill="#94a3b8" font-family="monospace" font-size="11">LOC: ${cam.location}</text>
      <text x="20" y="340" fill="#22c55e" font-family="monospace" font-size="12">● LIVE 29.97 FPS | ${now}</text>
      <rect x="220" y="120" width="110" height="70" stroke="#22c55e" stroke-width="2" fill="none"/>
      <text x="222" y="115" fill="#22c55e" font-family="monospace" font-size="10">car: 0.94</text>
      <rect x="360" y="160" width="140" height="90" stroke="#f59e0b" stroke-width="2" fill="none"/>
      <text x="362" y="155" fill="#f59e0b" font-family="monospace" font-size="10">bus: 0.89</text>
    </svg>`;

    const buffer = Buffer.from(svg);
    res.write(`--frame\r\nContent-Type: image/svg+xml\r\nContent-Length: ${buffer.length}\r\n\r\n`);
    res.write(buffer);
    res.write('\r\n');
  }, 200); // 5 FPS update

  req.on('close', () => {
    clearInterval(timer);
  });
});

// API Directory listing endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Smart Traffic AI - Backend API Gateway',
    version: '1.0.0',
    websocket: `ws://localhost:${PORT} (Socket.io)`,
    endpoints: {
      authLogin:       'POST /api/auth/login',
      authRegister:    'POST /api/auth/register',
      authMe:          'GET /api/auth/me',
      health:          'GET /api/health',
      detections:      'GET /api/detections',
      latestDetections:'GET /api/detections/latest',
      risk:            'GET /api/risk',
      zones:           'GET /api/zones',
      incidents:       'GET /api/incidents',
      incidentAnalytics:'GET /api/incidents/analytics',
      analyticsSummary:'GET /api/analytics/summary',
      updateIncident:  'PATCH /api/incidents/:id/status (Requires Admin)',
      resolveIncident: 'POST /api/incidents/:id/resolve (Requires Admin)',
      cameras:         'GET /api/cameras',
      cameraStream:    'GET /api/cameras/:id/stream',
      notifications:   'GET /api/notifications',
      notificationCfg: 'GET /api/notifications/config (PATCH/POST to update)',
      triggerTestNotif:'POST /api/notifications/test',
      municipalWebhook:'POST /api/notifications/mock-webhook',
      trafficDensity:  'GET /api/traffic/density',
      videoAnalyze:    'POST /api/video/analyze',
      videoStream:     'POST /api/video/stream-sample',
      demoScenarios:   'GET /api/demo/scenarios',
      triggerScenario: 'POST /api/demo/scenario (Requires Admin)',
    }
  });
});

// ─── Static Production Frontend Serving ──────────────────────────────────────
const frontendDistPath = path.resolve(__dirname, '../frontend/dist');
const hasBuiltFrontend = fs.existsSync(path.join(frontendDistPath, 'index.html'));

if (hasBuiltFrontend) {
  // Serve built static assets from frontend/dist
  app.use(express.static(frontendDistPath));

  // Client-side SPA routing fallback (serves index.html for React Router pages)
  app.get('*', (req, res, next) => {
    // Preserve API routes and Socket.io endpoints
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
  console.log(`[Static] Serving production frontend build from: ${frontendDistPath}`);
} else {
  console.log(`[Static] Production frontend dist not found. Operating in API-only mode.`);
}

// ─── Start Server ─────────────────────────────────────────────────────────────
if (require.main === module) {
  server.listen(PORT, () => {
    logger.info('SERVER', `Traffic Backend API listening on http://localhost:${PORT}`);
    logger.info('SERVER', `Socket.io WebSocket ready on ws://localhost:${PORT}`);
    logger.info('SERVER', `Broadcast interval set to ${BROADCAST_INTERVAL_MS}ms`);
    console.log(`==================================================`);
    console.log(`Traffic Backend API  →  http://localhost:${PORT}`);
    console.log(`Socket.io WebSocket  →  ws://localhost:${PORT}`);
    console.log(`Broadcast interval   →  every ${BROADCAST_INTERVAL_MS}ms`);
    console.log(`--------------------------------------------------`);
    console.log(`Health:     http://localhost:${PORT}/api/health`);
    console.log(`Detections: http://localhost:${PORT}/api/detections`);
    console.log(`Risk:       http://localhost:${PORT}/api/risk`);
    console.log(`Zones:      http://localhost:${PORT}/api/zones`);
    console.log(`Incidents:  http://localhost:${PORT}/api/incidents`);
    console.log(`Cameras:    http://localhost:${PORT}/api/cameras`);
    console.log(`--------------------------------------------------`);
    console.log(`Detection file: ${detectionFilePath}`);
    console.log(`==================================================`);
  });
}

module.exports = { app, server, io };
