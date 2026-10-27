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

### 4.2 Backend API (`backend/`)

- **State:** Implemented.
- **Configuration:** Managed via `backend/.env` (default `PORT=5000`, `CORS_ORIGIN=http://localhost:5173`).
- **Endpoints:**

| Method | Endpoint | Status | Description |
|---|---|---|---|
| `GET` | `/` | Implemented | Service metadata and available route listing |
| `GET` | `/api/health` | Implemented | Service health status and detection file presence check |
| `GET` | `/api/detections` | Implemented | Full detection results combined with calculated risk assessment |
| `GET` | `/api/detections/latest` | Implemented | Summary and latest frame vehicle metrics |
| `GET` | `/api/risk` | Implemented | Standalone rule-based risk assessment object |

### 4.3 AI Service (`ai-service/`)

- **State:** Implemented (code complete; requires local Python virtual environment activation).
- **Core Files:**
  - [`ai-service/detector.py`](ai-service/detector.py): Video decoding and YOLO inference pipeline.
  - [`ai-service/main.py`](ai-service/main.py): FastAPI web application with lifespan model caching.
  - [`ai-service/schemas.py`](ai-service/schemas.py): Pydantic validation schemas.
  - [`ai-service/risk_calculator.py`](ai-service/risk_calculator.py): Python reference implementation of the risk formula.
- **Endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service root and version metadata |
| `GET` | `/health` | Service status and YOLO model memory state |
| `GET` | `/detect/sample` | Executes detection on default sample video |
| `POST` | `/detect` | Runs detection on user-specified video path |

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
