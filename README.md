# 🚦 Smart Traffic Management & Accident Risk Prediction System

A local-first system designed for automated vehicle detection, traffic density assessment, and rule-based accident risk indication from video feeds.

---

## System Overview

The system processes video input to extract vehicle metrics and surface real-time traffic statistics through a web dashboard:

1. **Vehicle Detection:** Identifies cars, trucks, buses, and motorcycles in video frames using YOLOv8 and OpenCV.
2. **Traffic Analytics:** Computes vehicle counts, traffic density, and congestion levels.
3. **Accident Risk Indication:** Evaluates real-time risk scores (0–100) using a transparent, deterministic engineering heuristic based on density, volume trends, heavy vehicle composition, and congestion thresholds.
4. **Operator Dashboard:** Visualizes metrics, road segment status, vehicle breakdowns, and detection logs in a React application.
5. **API Coordination:** A Node.js and Express backend coordinates data flow and provides REST endpoints.

---

## Implementation Status

| Subsystem / Feature | Status | Notes |
|---|---|---|
| **Frontend Dashboard** (`frontend/`) | **Implemented** | React + Vite dashboard displaying stats, breakdown bars, detection table, and risk gauge with automatic fallback support. |
| **Backend API** (`backend/`) | **Implemented** | Express server with CORS, health check (`/api/health`), detection data (`/api/detections`, `/api/detections/latest`), and risk endpoint (`/api/risk`). |
| **Vehicle Detector** (`ai-service/detector.py`) | **Implemented** | OpenCV frame ingestion + YOLOv8 inference filtering vehicle classes (car, truck, bus, motorcycle). |
| **FastAPI Service** (`ai-service/main.py`) | **Implemented** | HTTP service exposing `/health`, `/detect/sample`, and `POST /detect`. |
| **Rule-Based Risk Calculation** | **Implemented** | Grounded deterministic formula implemented in `backend/utils/riskCalculator.js` and `ai-service/risk_calculator.py`. |
| **Database Persistence (MongoDB)** | **Planned** | Data currently passes through REST and reads from processed JSON; persistent DB storage is not yet connected. |
| **Supervised ML Risk Model (XGBoost)** | **Planned (Deferred)** | Documented in `docs/feats/dataset-review-and-limitations.md`. Supervised crash prediction requires synchronized ground-truth crash video data not available in public sets. |

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Vite | Operator interface |
| **Backend** | Node.js, Express, Dotenv, CORS | REST API coordinator |
| **AI / Computer Vision** | Python 3, FastAPI, Ultralytics YOLOv8, OpenCV | Object detection and video frame processing |
| **Risk Scoring** | Deterministic Heuristic Model | Transparent rule-based hazard assessment |
| **Database (Planned)** | MongoDB | Persistent historical storage |

---

## Architecture and Data Flow

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

---

## Project Structure

```
smart-traffic-ai-project/
│
├── README.md                   ← Project overview and setup
├── AGENTS.md                   ← Coding instructions for AI assistants
├── package.json                ← Root workspace script shortcuts
├── .gitignore                  ← Git exclusion rules
│
├── docs/                       ← Documentation specifications
│   ├── tasks.md                ← Phased task tracker
│   ├── platform/
│   │   └── architecture.md     ← System architecture and API design
│   └── feats/
│       ├── vehicle-detection.md             ← Detection specification
│       └── dataset-review-and-limitations.md← Dataset review & risk fallback spec
│
├── frontend/                   ← React + Vite operator dashboard
│   ├── src/
│   │   ├── components/         ← Reusable UI panels (Header, RiskGauge, StatCard, etc.)
│   │   ├── services/api.js     ← Client API fetch utility
│   │   ├── data/sampleData.js  ← Fallback mock dataset
│   │   └── App.jsx             ← Main view assembling dashboard panels
│   ├── package.json
│   └── vite.config.js
│
├── backend/                    ← Node.js + Express API
│   ├── utils/riskCalculator.js ← Deterministic risk calculation helper
│   ├── server.js               ← API server implementation
│   ├── .env.example            ← Environment variable template
│   └── package.json
│
└── ai-service/                 ← Python FastAPI vehicle detection service
    ├── detector.py             ← YOLOv8 frame inference logic
    ├── main.py                 ← FastAPI web routes
    ├── config.py               ← Model settings and path configurations
    ├── schemas.py              ← Pydantic request and response schemas
    ├── test_detection.py       ← Standalone detection verification script
    ├── risk_calculator.py      ← Python reference implementation of risk logic
    ├── sample_video/           ← Directory for local test videos
    └── requirements.txt        ← Python dependencies
```

---

## Running the Application

### 1. AI Service (Python)

```bash
cd ai-service
# Create and activate virtual environment
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1

pip install -r requirements.txt

# Run standalone detection on sample video:
python test_detection.py

# Or start the FastAPI service:
uvicorn main:app --reload --port 8000
```
Interactive API documentation is available at `http://localhost:8000/docs`.

### 2. Backend Server (Node.js)

```bash
cd backend
npm install
npm start
```
Default server port is `5000`. Health check: `http://localhost:5000/api/health`.

### 3. Frontend Dashboard (React + Vite)

```bash
cd frontend
npm install
npm run dev
```
Dashboard runs at `http://localhost:5173`. If the backend is running, it streams live detection data; if unreachable, it displays fallback sample data automatically.

---

## Documentation Index

- [`docs/platform/architecture.md`](docs/platform/architecture.md) — System architecture, data flow, and endpoint reference.
- [`docs/feats/vehicle-detection.md`](docs/feats/vehicle-detection.md) — Technical specification for YOLOv8 detection.
- [`docs/feats/dataset-review-and-limitations.md`](docs/feats/dataset-review-and-limitations.md) — Analysis of public datasets, spatiotemporal mismatch constraints, and rule-based risk formulation.
- [`docs/tasks.md`](docs/tasks.md) — Milestone checklist and decisions log.
