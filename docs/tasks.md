# Task List — Smart Traffic Management & Accident Risk Prediction System

> Project milestone checklist tracking completed, active, and planned engineering tasks.

**Status Legend:**  
`[ ]` Planned / Not started &nbsp;|&nbsp; `[/]` In progress &nbsp;|&nbsp; `[x]` Implemented / Completed

---

## Milestone 1 — Documentation & Planning *(Completed)*

- [x] Create project specification in `README.md`
- [x] Define assistant operational rules in `AGENTS.md`
- [x] Document system data flows in `docs/platform/architecture.md`
- [x] Document computer vision spec in `docs/feats/vehicle-detection.md`
- [x] Configure repository exclusions in `.gitignore`
- [x] Define target architecture decisions (local-first execution, video source = local `.mp4`)

---

## Milestone 2 — Frontend Prototype *(Completed)*

- [x] Scaffold React 18 + Vite project structure in `frontend/`
- [x] Build dark-theme operator dashboard interface in `frontend/src/index.css`
- [x] Implement top-level KPI cards (`StatCard.jsx`) for vehicle count, density, and confidence
- [x] Implement per-segment congestion progress indicators (`CongestionStatus.jsx`)
- [x] Implement SVG circular risk gauge dial (`RiskGauge.jsx`)
- [x] Implement proportional vehicle category bar chart (`VehicleBreakdown.jsx`)
- [x] Implement recent detection table (`DetectionLog.jsx`)
- [x] Verify production build (`npm run build` succeeds with zero errors)

---

## Milestone 3 — AI Service: YOLO Vehicle Detection *(Completed)*

- [x] Configure Python dependencies in `ai-service/requirements.txt` (`fastapi`, `uvicorn`, `ultralytics`, `opencv-python`)
- [x] Define Pydantic request and response schemas in `ai-service/schemas.py`
- [x] Implement video ingestion and YOLOv8n inference pipeline in `ai-service/detector.py`
- [x] Create standalone test script `ai-service/test_detection.py`
- [x] Implement FastAPI endpoints (`/health`, `/detect/sample`, `POST /detect`) in `ai-service/main.py`
- [x] Add CORS support to FastAPI service for local frontend integration

---

## Milestone 4 — Backend API Gateway *(Completed)*

- [x] Configure Node.js project in `backend/package.json` (`express`, `cors`, `dotenv`)
- [x] Create environment variable configuration in `backend/.env` and `.env.example`
- [x] Implement Express server with CORS and health check (`/api/health`) in `backend/server.js`
- [x] Implement `GET /api/detections` and `GET /api/detections/latest` reading from AI detection output
- [x] Implement `GET /api/risk` endpoint

---

## Milestone 5 — Frontend-Backend Integration *(Completed)*

- [x] Implement frontend REST client utility in `frontend/src/services/api.js`
- [x] Connect dashboard state in `frontend/src/App.jsx` to fetch live data from `http://localhost:5000/api/detections`
- [x] Implement 10-second auto-polling with manual refresh option
- [x] Implement automatic fallback to sample data if backend API is unreachable
- [x] Add dynamic connection status badge in header ("Backend Connected" vs. "Fallback Mode")

---

## Milestone 6 — Risk Calculation & Limitations Analysis *(Completed)*

- [x] Research public accident and traffic video datasets (`docs/feats/dataset-review-and-limitations.md`)
- [x] Document spatiotemporal mismatch constraints preventing direct joining of public crash logs to video clips
- [x] Formulate transparent, deterministic rule-based risk heuristic ($R_t$)
- [x] Implement risk calculator in backend (`backend/utils/riskCalculator.js`)
- [x] Implement Python reference risk calculator in `ai-service/risk_calculator.py`
- [x] Bind dynamic risk score and 4-tier category mapping (Low, Medium, High, Critical) to the frontend RiskGauge

---

## Milestone 7 — Real-Time WebSocket Streaming *(Completed)*

- [x] Integrate Socket.io server into Express backend (`backend/server.js`) on shared port 5000
- [x] Implement periodic and event-triggered broadcast (`live_traffic_update`) to all clients
- [x] Implement socket ingestion event handler (`push_detection_frame`)
- [x] Create React Socket.io client service (`frontend/src/services/socket.js`) and custom hook (`frontend/src/hooks/useTrafficSocket.js`)
- [x] Bind React dashboard metrics, risk gauge, and congestion bars to live WebSocket push events
- [x] Create Python Socket.io client (`ai-service/socket_client.py`) to stream detection frames with $R_t$ risk scores
- [x] Update `ai-service/detector.py` and `ai-service/test_detection.py` with per-frame risk scoring and `--socket` streaming
- [x] Create presentation test/demo scenario runner (`ai-service/scenario_runner.py`) with automated sequence tour
- [x] Implement backend demo scenarios module (`backend/utils/demoScenarios.js`) with endpoints `GET /api/demo/scenarios` and `POST /api/demo/scenario`
- [x] Implement UI Viva Demo Scenario selector bar and floating persistent Simulation Control Panel (`frontend/src/components/SimulationPanel.jsx`) with emergency alert banners for High/Critical congestion states
- [x] Wire live Leaflet map and incident logs to real-time scenario updates

---

## Milestone 8 — Persistent Incident Storage & Historical Analytics *(Completed)*

- [x] Implement lightweight local persistence manager (`backend/utils/incidentStore.js`) saving to structured JSON (`backend/data/incidents.json`)
- [x] Support automatic incident recording from high-risk YOLO detection frames ($R_t \ge 67$ or vehicle count $\ge 10$) and demo scenarios
- [x] Implement lifecycle status tracking (`Active` vs. `Resolved`) with atomic writes and 15-second deduplication
- [x] Implement REST endpoints: `GET /api/incidents` (with filtering), `GET /api/incidents/analytics`, `PATCH /api/incidents/:id/status`, and `POST /api/incidents/:id/resolve`
- [x] Wire WebSocket events `resolve_incident` and live broadcast synchronization across all connected clients
- [x] Update React Incidents view (`frontend/src/pages/Incidents.jsx`) with status filter tabs, lifecycle badges, and quick-resolve action buttons
- [x] Implement dedicated dynamic Analytics view (`frontend/src/pages/Analytics.jsx`) with Recharts time-series volume trends, speed physics, and hotspot bar charts
- [x] Implement live multi-camera surveillance grid (`frontend/src/pages/Cameras.jsx`) and canvas HUD frame renderer (`frontend/src/components/CameraFeedCanvas.jsx`) for cameras `VID-001` through `VID-005`
- [x] Implement global high-risk notification system (`frontend/src/components/AlertBanner.jsx`) with Web Audio API chime synthesizer (`frontend/src/utils/alertSound.js`)
- [x] Implement production bundle chunk splitting in `frontend/vite.config.js` and static SPA serving in `backend/server.js`
- [x] Add robust WebSocket auto-reconnection with exponential backoff and continuous retry in `frontend/src/services/socket.js`
- [x] Create multi-stage container build (`backend/Dockerfile`) and Python computer vision container (`ai-service/Dockerfile`) orchestrated via root `docker-compose.yml`
- [x] Implement structured logging engine (`backend/utils/logger.js`) with HTTP middleware and WebSocket event tracing
- [x] Implement production container healthchecks (`GET /health` and `/api/health`) with filesystem, stream, and memory metrics
- [x] Implement unit testing suites: Jest for Node.js (`backend/__tests__/`) and PyTest for Python (`ai-service/tests/`) verifying $R_t$ risk heuristic and API endpoints
- [x] Harden backend security with Helmet HTTP protection headers, express-rate-limit DDOS throttling, and strict origin-checked CORS
- [x] Create automated multi-stage GitHub Actions CI pipeline (`.github/workflows/ci.yml`) for backend tests, Python PyTest, and frontend production compilation
- [x] Document full-stack environment variables across `backend/.env.example` and root `.env.example`
- [x] Implement Geo-Spatial Proximity & Geofencing Alert Engine (`backend/utils/geofence.js` and `ai-service/spatial_engine.py`) with point-in-bbox containment, Haversine proximity, Leaflet `<Polygon>` overlays, and sub-zone anomaly highlighting
- [x] Implement JWT Authentication & Role-Based Access Control (RBAC):
  - Local persistent user store in `backend/utils/userStore.js` (`backend/data/users.json`) with bcrypt password hashing
  - Auto-seeded presentation accounts: `admin@traffic.ai` (Admin role) and `operator@traffic.ai` (Operator role)
  - JWT generation and verification in `backend/utils/auth.js` (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`)
  - RBAC protection on backend mutation endpoints (`POST /api/demo/scenario`, `POST /api/incidents/:id/resolve`, `PATCH /api/incidents/:id/status`) and Socket.io events
  - React Auth context (`frontend/src/context/AuthContext.jsx`) with persistent token management and auto session recovery
  - Security Login page (`frontend/src/pages/Login.jsx`) with one-click demo login shortcuts for evaluation
  - Conditional UI rendering on Navigation Bar, Incident resolution buttons, and Simulation Control Panel based on user role
  - Comprehensive unit test suite in `backend/__tests__/auth.test.js` verifying token verification, role permissions, and route guards
- [x] Implement Automated Incident Notification & Webhook Dispatcher:
  - Notification engine in `backend/utils/notificationService.js` triggered on high-risk incidents ($R_t \ge 70$)
  - Configurable dispatch channels: Email Mock Dispatcher, SMS Emergency Dispatcher, and Municipal Outgoing HTTP Webhook
  - Persistent notification history (`backend/data/notifications.json`) and configuration store (`backend/data/notification_config.json`)
  - Real-time `notification_dispatched` WebSocket push to dashboard
  - Endpoints: `GET /api/notifications`, `GET /api/notifications/config`, `PATCH /api/notifications/config`, `POST /api/notifications/test`, and municipal simulation receiver `POST /api/notifications/mock-webhook`
  - React Notification Center & Settings Modal (`frontend/src/components/NotificationSettingsModal.jsx`) accessible from Navigation Bar
  - Unit and integration tests in `backend/__tests__/notificationService.test.js` verifying channel dispatching, cooldown deduplication, and REST endpoints

---

## Milestone 9 — Enterprise Database Persistence (MongoDB) *(Planned)*

- [ ] Install and configure MongoDB connection via Mongoose in backend
- [ ] Create Mongoose schema for frame-level detection records
- [ ] Create Mongoose schema for hourly aggregated traffic and risk summaries
- [ ] Persist incoming detection results to MongoDB upon processing
- [ ] Add query endpoint for historical trend analysis

---

## Milestone 10 — Advanced Tracking & Supervised Modeling *(Planned / Conditional)*

- [ ] Evaluate multi-object tracking (e.g., ByteTrack) for speed estimation across consecutive frames
- [ ] Evaluate spatiotemporally aligned micro-simulation datasets for supervised crash prediction
- [ ] Benchmark potential supervised ML models (e.g., XGBoost) against the deterministic baseline

---

## Decisions Log

| Date | Topic | Decision | Justification |
|---|---|---|---|
| 2026-10-27 | Containerization | Local execution without Docker | Keeps development lightweight and dependency-transparent on a single machine. |
| 2026-10-27 | Model Selection | YOLOv8n (nano) | Fastest inference speeds; operates effectively on CPU without GPU hardware requirements. |
| 2026-10-27 | Video Source | Local `.mp4` file | Consistent testing and reproducible demonstration baseline. |
| 2026-10-27 | Client Updates | WebSockets (Socket.io) with HTTP fallback | Real-time push without page refresh; handles live YOLO frame ingestion from Python. |
| 2026-10-27 | Risk Modeling | Deterministic heuristic for MVP | Evaluated in `dataset-review-and-limitations.md`. Public crash records cannot be spatiotemporally aligned to open video benchmarks without fabricating data. |
