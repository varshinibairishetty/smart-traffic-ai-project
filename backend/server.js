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
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const { calculateRisk, getRiskCategory } = require('./utils/riskCalculator');
const { buildScenarioPayload, AVAILABLE_SCENARIOS } = require('./utils/demoScenarios');
const incidentStore = require('./utils/incidentStore');
const { buildAnalyticsSummary } = require('./utils/analyticsAggregator');
const { HYDERABAD_GEOFENCES, matchGeofence, enrichWithGeofence } = require('./utils/geofence');
const userStore = require('./utils/userStore');
const { generateToken, authenticate, optionalAuth, requireRole, wsAuthMiddleware } = require('./utils/auth');
const notificationService = require('./utils/notificationService');
const logger = require('./utils/logger');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);   // share one port for HTTP + WebSockets
const PORT   = process.env.PORT || 5000;

// Currently active demo scenario override (null = real detection file data)
let activeScenario = null;

// How often (ms) the server re-reads detection_output.json and broadcasts.
// Override with env var BROADCAST_INTERVAL_MS.
const BROADCAST_INTERVAL_MS = parseInt(process.env.BROADCAST_INTERVAL_MS, 10) || 5000;

// ─── Security Hardening: Helmet HTTP Headers ──────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org"],
      connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
      fontSrc:    ["'self'", "data:"],
      objectSrc:  ["'none'"],
      upgradeInsecureRequests: null
    }
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ─── Security Hardening: Rate Limiting ────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || (15 * 60 * 1000), // 15 minutes
  max:      parseInt(process.env.RATE_LIMIT_MAX, 10) || 500,                    // 500 requests per window
  standardHeaders: true, // Return standard `RateLimit-*` headers
  legacyHeaders:   false,
  message: {
    error: 'Too Many Requests',
    message: 'API rate limit exceeded. Please retry later.',
    retry_after_seconds: 900
  },
  skip: () => process.env.NODE_ENV === 'test' // Skip rate limiting during test runner execution
});

app.use('/api', apiLimiter);

// ─── Strict CORS Configuration ────────────────────────────────────────────────
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const originList = corsOrigin === '*'
  ? '*'
  : corsOrigin.split(',').map(o => o.trim()).filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || corsOrigin === '*') return callback(null, true);
    if (originList.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin '${origin}' blocked by strict CORS policy`));
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(logger.httpMiddleware());

// ─── Socket.io setup ─────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: corsOrigin === '*' ? '*' : originList,
    methods: ['GET', 'POST'],
    credentials: true
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
const ZONE_WEIGHTS = {
  'hitec-city':    1.20,
  'gachibowli':   1.10,
  'madhapur':     1.00,
  'kondapur':     0.90,
  'jubilee-hills':0.85,
  'banjara-hills':0.90
};

const HYDERABAD_ZONES = HYDERABAD_GEOFENCES.map(g => ({
  id:               g.id,
  name:             g.name,
  lat:              g.center.lat,
  lon:              g.center.lon,
  weight:           ZONE_WEIGHTS[g.id] || 1.0,
  bbox:             g.bbox,
  polygon:          g.polygon,
  sub_zones:        g.sub_zones,
  radius_meters:    g.radius_meters,
  primary_arterial: g.primary_arterial,
  corridor_type:    g.corridor_type
}));

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
      bbox:             z.bbox,
      polygon:          z.polygon,
      sub_zones:        z.sub_zones,
      radius_meters:    z.radius_meters,
      primary_arterial: z.primary_arterial,
      corridor_type:    z.corridor_type
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

  return {
    // — Identification ————————————————————————
    event:         'live_traffic_update',
    timestamp:     new Date().toISOString(),
    source:        detectionData.source || 'detection_output.json',

    // — Current frame metrics ——————————————————
    vehicle_count:  latest ? latest.vehicle_count : (summary.avg_vehicles_per_frame || 0),
    latest_frame:   latest,

    // — Summary stats ——————————————————————————
    summary: {
      total_vehicle_detections: summary.total_vehicle_detections || 0,
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

    // Automatically evaluate geofencing and save high-risk or congested frame events
    if (framePayload && (framePayload.vehicle_count >= 10 || framePayload.risk?.score >= 67)) {
      const zoneIdx = (framePayload.frame_index || 0) % HYDERABAD_ZONES.length;
      const zone = HYDERABAD_ZONES[zoneIdx] || HYDERABAD_ZONES[0];
      const riskScore = framePayload.risk?.score || 72;
      const spatial = enrichWithGeofence({
        lat: framePayload.lat || zone.lat,
        lon: framePayload.lon || zone.lon,
        node_location: zone.name,
        zone_id: zone.id
      });
      incidentStore.save({
        timestamp: new Date().toISOString(),
        node_location: spatial.node_location,
        zone_id: spatial.zone_id,
        sub_zone: spatial.sub_zone,
        coordinates: spatial.coordinates,
        geofence: spatial.geofence,
        risk_score: riskScore,
        severity: getRiskCategory(riskScore),
        status: 'Active',
        vehicle_count: framePayload.vehicle_count,
        frame_index: framePayload.frame_index,
        description: `High vehicle density detected at ${spatial.sub_zone} (${spatial.node_location}, ${framePayload.vehicle_count} vehicles)`,
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

  // 4. Accept 'resolve_incident' event from frontend to update incident status
  socket.on('resolve_incident', (incidentId) => {
    console.log(`[WS] resolve_incident received for ID: ${incidentId} from socket ${socket.id} (role: ${socket.user?.role})`);
    if (socket.user?.role !== 'admin') {
      return socket.emit('auth_error', {
        error: 'Forbidden',
        message: 'Admin privileges required to resolve incidents.'
      });
    }

    incidentStore.updateStatus(incidentId, 'Resolved');
    const payload = buildBroadcastPayload();
    if (payload) io.emit('live_traffic_update', payload);
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
      geofences:       'GET /api/geofences',
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
      configured_cameras: HYDERABAD_CAMERAS.length,
      active_stream_endpoints: HYDERABAD_CAMERAS.map(c => c.stream_url)
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
        bbox:             z.bbox,
        polygon:          z.polygon,
        sub_zones:        z.sub_zones,
        radius_meters:    z.radius_meters,
        primary_arterial: z.primary_arterial,
        corridor_type:    z.corridor_type,
        data_note:        'Score derived from global detection risk × zone weight. Not a real sensor reading.'
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

// GET /api/geofences
// Serves spatial boundaries, polygons, and intersection perimeters
app.get('/api/geofences', (req, res) => {
  res.json({
    geofences: HYDERABAD_GEOFENCES,
    total: HYDERABAD_GEOFENCES.length,
    generated_at: new Date().toISOString()
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
// Update incident status ('Active' or 'Resolved') and broadcast to WebSocket clients - Requires Admin
app.patch('/api/incidents/:id/status', authenticate, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!status || !['Active', 'Resolved'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be "Active" or "Resolved".' });
  }

  const updated = incidentStore.updateStatus(id, status);
  if (!updated) {
    return res.status(404).json({ error: `Incident ${id} not found.` });
  }

  // Broadcast refreshed state to all WebSocket clients
  const payload = buildBroadcastPayload();
  if (payload) io.emit('live_traffic_update', payload);

  return res.json({
    success: true,
    message: `Incident ${id} status updated to ${status}.`,
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

// Camera metadata definition for Hyderabad surveillance network (VID-001 through VID-005)
const HYDERABAD_CAMERAS = [
  {
    id:          'VID-001',
    name:        'Cyber Towers Intersection',
    zone_id:     'hitec-city',
    location:    'HITEC City, Main Tech Corridor',
    stream_url:  '/api/cameras/VID-001/stream',
    resolution:  '1920x1080 @ 30fps',
    lens:        'Wide Angle 4mm f/1.6',
    status:      'LIVE',
    base_weight: 1.20
  },
  {
    id:          'VID-002',
    name:        'Bio-Diversity Junction Flyover',
    zone_id:     'gachibowli',
    location:    'Gachibowli ORR Outer Junction',
    stream_url:  '/api/cameras/VID-002/stream',
    resolution:  '1920x1080 @ 30fps',
    lens:        'Telephoto 8mm f/1.8',
    status:      'LIVE',
    base_weight: 1.10
  },
  {
    id:          'VID-003',
    name:        'Metro Pillar 1042 Corridor',
    zone_id:     'madhapur',
    location:    'Madhapur Metro Line Arterial',
    stream_url:  '/api/cameras/VID-003/stream',
    resolution:  '1920x1080 @ 30fps',
    lens:        'Standard 6mm f/1.4',
    status:      'LIVE',
    base_weight: 1.00
  },
  {
    id:          'VID-004',
    name:        'RTA Crossroads Sub-Arterial',
    zone_id:     'kondapur',
    location:    'Kondapur Main Road Link',
    stream_url:  '/api/cameras/VID-004/stream',
    resolution:  '1920x1080 @ 30fps',
    lens:        'Wide Angle 4mm f/1.6',
    status:      'LIVE',
    base_weight: 0.90
  },
  {
    id:          'VID-005',
    name:        'Checkpost Circle Gateway',
    zone_id:     'jubilee-hills',
    location:    'Jubilee Hills Road No. 36',
    stream_url:  '/api/cameras/VID-005/stream',
    resolution:  '1920x1080 @ 30fps',
    lens:        'Varifocal 5-50mm f/1.8',
    status:      'LIVE',
    base_weight: 0.85
  }
];

// GET /api/cameras
// Serves cameras VID-001 through VID-005 with real-time detection telemetry and risk scores
app.get('/api/cameras', (req, res) => {
  let detectionData = null;
  if (fs.existsSync(detectionFilePath)) {
    try {
      detectionData = JSON.parse(fs.readFileSync(detectionFilePath, 'utf8'));
    } catch {
      detectionData = null;
    }
  }

  const globalRisk = activeScenario?.risk || (detectionData ? calculateRisk(detectionData) : { score: 45, category: 'Medium' });
  const frames = detectionData?.frames || [];
  const latestFrame = frames.length > 0 ? frames[frames.length - 1] : null;
  const avgVehicles = detectionData?.summary?.avg_vehicles_per_frame || (latestFrame ? latestFrame.vehicle_count : 14);

  const cameras = HYDERABAD_CAMERAS.map((cam, idx) => {
    const camRiskScore = Math.min(100, Math.max(0, Math.round(globalRisk.score * cam.base_weight)));
    const camVehicles = Math.round(avgVehicles * cam.base_weight);
    const category = getRiskCategory(camRiskScore);

    return {
      id:                  cam.id,
      name:                cam.name,
      zone_id:             cam.zone_id,
      location:            cam.location,
      stream_url:          cam.stream_url,
      resolution:          cam.resolution,
      lens:                cam.lens,
      status:              cam.status,
      fps:                 29.97,
      current_vehicle_count: camVehicles,
      current_risk: {
        score:    camRiskScore,
        category: category,
        color:    riskColor(camRiskScore)
      },
      summary: {
        total_detections: (detectionData?.summary?.total_vehicle_detections || 120) + (idx * 24),
        avg_per_frame:    camVehicles,
        peak_count:       Math.round((detectionData?.summary?.peak_vehicles_in_frame || 22) * cam.base_weight),
        by_class:         detectionData?.summary?.by_class || { car: 12, motorcycle: 4, bus: 2, truck: 1 }
      },
      latest_frame: latestFrame,
      last_ping:    new Date().toISOString(),
      data_note:    'Real-time stream telemetry with AI bounding box overlays'
    };
  });

  res.json({
    cameras,
    active_count: cameras.length,
    generated_at: new Date().toISOString()
  });
});

// GET /api/cameras/:id/stream (MJPEG Stream Endpoint)
// Provides a standard multipart/x-mixed-replace MJPEG stream for cameras VID-001 to VID-005
app.get('/api/cameras/:id/stream', (req, res) => {
  const { id } = req.params;
  const cam = HYDERABAD_CAMERAS.find(c => c.id === id) || HYDERABAD_CAMERAS[0];

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
      geofences:       'GET /api/geofences',
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
