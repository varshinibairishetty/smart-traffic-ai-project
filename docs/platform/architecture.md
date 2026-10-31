# System Architecture — Smart Traffic Management & Accident Risk Prediction System

> **Status:** Active architecture baseline. Distinguishes implemented components from planned extensions.

---

## 1. Design Objectives

- **Local Execution:** Runs locally without cloud infrastructure or third-party paid APIs.
- **Service Decoupling:** Three autonomous processes (AI Service, Backend API, Frontend Dashboard) communicating over standard HTTP REST.
- **Explainability:** Real-time risk indicator derived from an explicit, deterministic engineering formula rather than unverifiable pseudo-predictive models.

---

## 2. Services Overview

| Service | Technology | Default Port | Implementation Status | Purpose |
|---|---|---|---|---|
| **Frontend** | React 18 + Vite | 5173 | **Implemented** | Operator dashboard for traffic metrics, density, and risk visualization. |
| **Backend API** | Node.js + Express | 5000 | **Implemented** | API gateway serving detection outputs and calculating rule-based risk. |
| **AI Service** | Python + FastAPI | 8000 | **Implemented** | Runs YOLOv8 vehicle detection on sampled video frames. |
| **Database** | MongoDB | 27017 | **Planned** | Historical persistence for aggregated traffic metrics and risk logs. |

---

## 3. System Data Flow

```
┌────────────────────────────────────────────────────────┐
│                   Local Environment                    │
│                                                        │
│  Local .mp4 Video File                                 │
│        │                                               │
│        ▼                                               │
│  ┌──────────────────┐    POST /detect                  │
│  │    AI Service    │ ◀────────────────  Backend API   │
│  │ Python + FastAPI │                   Node + Express │
│  │   :8000          │ ────────────────▶  :5000         │
│  │  (YOLOv8 + CV)   │    JSON Output           │       │
│  └──────────────────┘                          │       │
│                                                │       │
│                                                │ REST  │
│                                                ▼       │
│                                         ┌────────────┐ │
│                                         │  Frontend  │ │
│                                         │ React+Vite │ │
│                                         │   :5173    │ │
│                                         └────────────┘ │
└────────────────────────────────────────────────────────┘
```

### End-to-End Operation Flow

1. **Video Ingestion:** An `.mp4` video file located in `ai-service/sample_video/` is loaded via OpenCV.
2. **Vehicle Detection:** YOLOv8n performs inference on sampled frames (default interval: every 5 frames), filtering for `car`, `truck`, `bus`, and `motorcycle` classes.
3. **Structured Export:** Detection bounding boxes, counts, and per-class distributions are exported to `ai-service/detection_output.json`.
4. **Backend Ingestion & Risk Scoring:** The Express backend (`backend/server.js`) ingests the JSON output and calculates a deterministic risk score (0–100) via `backend/utils/riskCalculator.js`.
5. **Dashboard Consumption:** The React frontend polls `http://localhost:5000/api/detections` every 10 seconds, visualizing dynamic counts, segment congestion, and the color-coded risk gauge. If the backend is offline, the frontend falls back cleanly to static demonstration fixtures.

---

## 4. Subsystem Details

### 4.1 Frontend Dashboard (`frontend/`)

- **State:** Implemented.
- **Key Modules:**
  - [`frontend/src/App.jsx`](frontend/src/App.jsx): Central dashboard container managing polling lifecycle and live/fallback state.
  - [`frontend/src/services/api.js`](frontend/src/services/api.js): REST client querying backend endpoints.
  - [`frontend/src/components/RiskGauge.jsx`](frontend/src/components/RiskGauge.jsx): SVG circular dial rendering risk scores and categories.
  - [`frontend/src/components/CongestionStatus.jsx`](frontend/src/components/CongestionStatus.jsx): Road segment distribution and status bars.
  - [`frontend/src/components/VehicleBreakdown.jsx`](frontend/src/components/VehicleBreakdown.jsx): Proportional vehicle category distribution.
  - [`frontend/src/components/DetectionLog.jsx`](frontend/src/components/DetectionLog.jsx): Table displaying recent frame detections.
  - [`frontend/src/components/SimulationPanel.jsx`](frontend/src/components/SimulationPanel.jsx): Floating persistent simulation control panel for one-click testing of live map markers and risk scores.
  - [`frontend/src/pages/LiveMap.jsx`](frontend/src/pages/LiveMap.jsx): Interactive Leaflet map with real-time colored zone risk markers.

### 4.2 Backend API (`backend/`)

- **State:** Implemented.
- **Security & Configuration:** Clean CORS middleware configuration and environment variables managed via `dotenv`.
- **Endpoints:**

| Method | Endpoint | Status | Description |
|---|---|---|---|
| `GET` | `/` | Implemented | Service metadata or static React production dashboard |
| `GET` | `/api` | Implemented | Dedicated API Directory listing and service metadata |
| `POST` | `/api/auth/register` | Implemented | User registration with bcrypt-hashed passwords and JWT issuance |
| `POST` | `/api/auth/login` | Implemented | User login verifying credentials and returning user profile + JWT token |
| `GET` | `/api/auth/me` | Implemented | Returns authenticated user session payload (requires Bearer token) |
| `GET` | `/health` | Implemented | Container orchestration healthcheck with storage, stream, and memory metrics |
| `GET` | `/api/health` | Implemented | Service health status and subsystem checks |
| `GET` | `/api/locations` | Implemented | List all 6 configured Hyderabad locations with metadata and coordinates |
| `GET` | `/api/locations/:id` | Implemented | Detailed telemetry view for a specific junction (traffic, weather, incidents) |
| `GET` | `/api/accidents/historical` | Implemented | Archival Hyderabad accident records collection across monitored junctions |
| `GET` | `/api/accidents/historical/:locationId` | Implemented | Archival collision logs, severity breakdown, casualty totals, and Hotspot Risk Index for a specific junction |
| `GET` | `/api/risk/location/:locationId` | Implemented | Mode B aligned multimodal risk analysis combining live Open-Meteo weather, TomTom flow, historical crash records, heuristic $R_t$, and full data provenance audit table |
| `GET` | `/api/traffic/live` | Implemented | Current TomTom traffic flow metrics for all locations (cached with 5-min TTL) |
| `GET` | `/api/weather/live` | Implemented | Current meteorological conditions for all locations via Open-Meteo (15-min TTL) |
| `GET` | `/api/incidents/active`| Implemented | Verified provider-reported active incidents within Hyderabad bounding box |
| `GET` | `/api/telemetry/live` | Implemented | Unified multi-modal telemetry (traffic + weather + incidents) across all junctions |
| `POST` | `/api/telemetry/refresh`| Implemented | Invalidate cache and force live external fetch from traffic and weather APIs |
| `GET` | `/api/detections` | Implemented | Full detection results combined with calculated risk assessment |
| `GET` | `/api/detections/latest` | Implemented | Summary and latest frame vehicle metrics |
| `GET` | `/api/risk` | Implemented | Standalone rule-based risk assessment object |
| `GET` | `/api/zones` | Implemented | Hyderabad regional nodes with derived risk scores and coordinates |
| `GET` | `/api/incidents` | Implemented | Persistent incident logs with filtering (`status`, `zone_id`, `severity`) |
| `GET` | `/api/incidents/analytics` | Implemented | Aggregated incident statistics (by location, severity, resolution rate) |
| `GET` | `/api/analytics/summary` | Implemented | Comprehensive historical analytics & time-series data for dashboard charts |
| `PATCH` | `/api/incidents/:id/status` | Implemented | Update incident lifecycle status (`Active` / `Dispatched` / `Resolved`) with WebSocket broadcast |
| `POST` | `/api/incidents/:id/resolve` | Implemented | Convenience endpoint to resolve an active incident — **Requires Admin** |
| `GET` | `/api/cameras` | Implemented | Dynamic Active Cameras catalog mapped from codebase `videos/` folder with active incidents and high-risk zones |
| `GET` | `/api/cameras/:id/stream` | Implemented | Multipart/x-mixed-replace MJPEG video stream endpoint |
| `GET` | `/api/videos` | Implemented | List local traffic video feeds detected in `videos/` (video1_hitec_city.mp4, video2_gachibowli.mp4, etc.) |
| `POST` | `/api/videos/select` | Implemented | Select and process local traffic video feed with YOLOv8 counting & $R_t$ risk calculation |
| `POST` | `/api/upload-video` | Implemented | Upload traffic video (`.mp4`, `.avi`, `.mov`) and execute full YOLOv8 detection & $R_t$ risk calculation |
| `GET` | `/api/traffic/density` | Implemented | Stage 4 corridor density, saturation capacity ($K_{\text{sat}} = 25$), Level of Service (LOS), and interval volume |
| `POST` | `/api/video/analyze` | Implemented | Trigger video detection and multi-object tracking pipeline analysis |
| `POST` | `/api/video/stream-sample` | Implemented | Replay sample video frame stream over Socket.io at controlled demonstration pace |
| `GET` | `/api/notifications` | Implemented | Dispatched notification audit logs with channel and severity filters |
| `GET` | `/api/notifications/config` | Implemented | Outgoing notification channel status and risk threshold configuration |
| `PATCH`| `/api/notifications/config` | Implemented | Update notification channels, risk threshold ($R_t \ge 70$), and webhook URL |
| `POST` | `/api/notifications/test` | Implemented | Trigger synthetic test alert dispatch across active channels |
| `POST` | `/api/notifications/mock-webhook` | Implemented | Municipal Police Webhook receiver simulation endpoint |
| `GET` | `/api/demo/scenarios` | Implemented | Available test/viva presentation simulation scenarios |
| `POST` | `/api/demo/scenario` | Implemented | Activate or reset a simulation scenario override — **Requires Admin** |
| `WS`  | `live_traffic_update` | Implemented | Periodic & frame-triggered Socket.io broadcast to all clients |
| `WS`  | `push_detection_frame` | Implemented | Ingestion event accepted from Python YOLO socket client |
| `WS`  | `trigger_scenario` | Implemented | Real-time scenario switch event accepted from clients — **Requires Admin** |
| `WS`  | `resolve_incident` | Implemented | Instant incident status resolution event accepted from clients |
| `WS`  | `update_incident_status` | Implemented | Instant status change event (`Active`, `Dispatched`, `Resolved`) with peer broadcast |
| `WS`  | `notification_dispatched` | Implemented | Real-time broadcast whenever an incident alert is dispatched to channels |

### 4.3 AI Service (`ai-service/`)

- **State:** Implemented (code complete; requires local Python virtual environment activation).
- **Core Files:**
  - [`ai-service/detector.py`](ai-service/detector.py): Video decoding and YOLO inference pipeline with multi-object tracking, per-frame risk scoring, and optional socket streaming.
  - [`ai-service/tracker.py`](ai-service/tracker.py): Multi-Object Vehicle Tracker (IoU association, persistent `track_id`, trajectory history, and tripwire line crossing).
  - [`ai-service/traffic_density.py`](ai-service/traffic_density.py): Stage 4 corridor density analysis, saturation capacity ($K_{\text{sat}} = 25$), and Level of Service classification.
  - [`ai-service/socket_client.py`](ai-service/socket_client.py): Python Socket.io client emitting `push_detection_frame` live events.
  - [`ai-service/scenario_runner.py`](ai-service/scenario_runner.py): Viva presentation test and demo scenario runner with automated sequence tour.
  - [`ai-service/test_detection.py`](ai-service/test_detection.py): Standalone CLI test script with `--socket` streaming flag.
  - [`ai-service/main.py`](ai-service/main.py): FastAPI web application with lifespan model caching and video file upload support.
  - [`ai-service/schemas.py`](ai-service/schemas.py): Pydantic validation schemas with tracking and density structures.
  - [`ai-service/risk_calculator.py`](ai-service/risk_calculator.py): Python reference implementation of the risk formula.
- **Endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service root and version metadata |
| `GET` | `/health` | Service status and YOLO model memory state |
| `GET` | `/detect/sample` | Executes detection and tracking on default sample video |
| `POST` | `/detect` | Runs detection and tracking on user-specified video path |
| `POST` | `/detect/upload` | Upload local video file (`.mp4`, `.avi`, `.mov`) for automated YOLOv8 and tracking pipeline |

### 4.4 Dual-Mode Multimodal Architecture & Data Provenance

To resolve the fundamental spatiotemporal misalignment problem between arbitrary uploaded videos and location-specific sensor/historical data, the platform is cleanly decoupled into two distinct operational modes:

#### Mode A: Traffic Video Analysis (`/cameras`)
- **Focus:** Pure computer vision analysis on uploaded or locally stored `.mp4` surveillance videos.
- **Processing:** YOLOv8n object detection (IDs 2: car, 3: motorcycle, 5: bus, 7: truck) with OpenCV decoding, centroid tracking, and queue accumulation evaluation ($K_{\text{sat}} = 25$).
- **Optional Metadata Tagging:** Users may optionally tag an uploaded video with a known Hyderabad location and recording timestamp.
- **Strict Isolation for Untagged Videos:** If location or timestamp is omitted, the video is marked as `UNKNOWN`. The system strictly evaluates it in isolation and **never automatically attaches HITEC City weather or accident history** to an unverified-location video.

#### Mode B: Location-Based Accident Risk Analysis (`/accident-risk`)
- **Focus:** Spatiotemporally aligned multimodal risk monitoring across 6 key Hyderabad junctions (HITEC City Cyber Towers, Gachibowli Bio-Diversity, Mindspace, Kukatpally Y-Junction, Punjagutta, Secunderabad Station).
- **Usable without CCTV Feeds:** Does not require live camera access or manual video uploads.
- **Data Ingestion:**
  - **Live Weather (`API_RETRIEVED`):** Open-Meteo API using exact junction coordinates ($0 cost, 15-min cache).
  - **Traffic Flow (`API_RETRIEVED`):** TomTom Traffic Flow API (if key configured) providing current speed, free-flow speed, and congestion ratio.
  - **Archival Accident Logs (`HISTORICAL_RECORD`):** Documented municipal crash records for that exact junction.
- **Three Distinct Risk Indicators:**
  1. *Historical Hotspot Risk Index (0-100):* Derived from archival collision severity and casualty totals.
  2. *Current Traffic Congestion (0-100%):* Derived from real-time speed ratio or CV density.
  3. *Estimated Future Accident Risk (0-100):* Explainable deterministic heuristic baseline ($R_t$).
- **Data Provenance & Alignment Audit:** Every displayed metric carries an explicit provenance tag (`MEASURED`, `API_RETRIEVED`, `HISTORICAL_RECORD`, `CALCULATED`, or `UNAVAILABLE`).

---

### 4.5 Local Video Ingestion & YOLOv8 Processing Pipeline

The platform is 100% video-driven, operating directly on local traffic video feeds without relying on external commercial traffic APIs or cloud dependencies:

```
┌──────────────────────────────────────────────┐
│        Local Video Feeds (`videos/`)         │
│   • video1_hitec_city.mp4, gachibowli.mp4    │
│   • User-uploaded .mp4 / .avi / .mov feeds   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│           OpenCV Video Ingestion             │
│   • cv2.VideoCapture header validation       │
│   • Native frame sampling (N = 5 frames)     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│       Ultralytics YOLOv8n Inference          │
│   • COCO class filtering: car, bike, bus,    │
│     truck (IDs 2, 3, 5, 7)                   │
│   • Centroid tracking & tripwire crossings   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  Deterministic Risk Engine ($R_t$) & LOS     │
│   • $K_{\text{sat}} = 25$ vehicles           │
│   • Queue accumulation bottlenecks ($V_t>15$)│
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│       REST & WebSocket Telemetry Gateway     │
│   • /api/cameras, /api/videos/select         │
│   • /api/upload-video, live_traffic_update   │
└──────────────────────────────────────────────┘
```

- **Video Ingestion:** Direct file drop into `videos/` or direct `.mp4` file upload from the dashboard.
- **YOLOv8 Detection:** Instantaneous class counts (cars, motorcycles, buses, trucks) and bounding boxes.
- **Bottlenecks & Incident Derivation:** Real traffic bottlenecks derived directly from vehicle accumulation ($V_t \ge 15$) and density thresholds.
- **Provisional Heuristic Risk ($R_t$):** Evaluated strictly from observed video metrics without fabricating accident probabilities.

---

## 5. Risk Assessment Logic

Due to documented spatiotemporal mismatch between public historical accident registries (e.g., STATS19) and open video benchmarks, the MVP utilizes an explainable, deterministic engineering heuristic:

$$R_t = \min\left(100, \; 0.55 \cdot D_t + 0.20 \cdot V_{\text{trend}} + 0.15 \cdot M_t + 0.10 \cdot P_t\right)$$

- **$D_t$ (Density Factor):** Ratio of current count to nominal lane saturation ($K_{\text{sat}} = 25$ vehicles).
- **$V_{\text{trend}}$ (Volume Trend):** Average volume over recent sampling window.
- **$M_t$ (Fleet Mix Penalty):** Additional weight for heavy commercial vehicles and motorcycles.
- **$P_t$ (Congestion Factor):** Proximity penalty applied when density exceeds 70%.

Score bands map directly to:
- **Low Risk:** 0 – 34 (Green)
- **Medium Risk:** 35 – 66 (Amber)
- **High Risk:** 67 – 84 (Orange)
- **Critical Risk:** 85 – 100 (Red)

Refer to [`docs/feats/dataset-review-and-limitations.md`](../feats/dataset-review-and-limitations.md) for full mathematical derivation and validation analysis.

---

## 6. Planned Architectural Extensions

1. **Database Layer (MongoDB):**
   - Mongoose schemas for historical detection archiving (`DetectionLog`) and hourly risk rollups (`RiskSummary`).
2. **Object Tracking:**
   - Multi-object tracking (e.g., ByteTrack) to estimate relative vehicle speeds across frames.
3. **Supervised ML Model:**
   - Training a predictive model (e.g., XGBoost) if a spatiotemporally aligned dataset with synchronized collision ground truth is acquired.
