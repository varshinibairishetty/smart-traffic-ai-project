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

## Milestone 7 — Database Persistence (MongoDB) *(Planned)*

- [ ] Install and configure MongoDB connection via Mongoose in backend
- [ ] Create Mongoose schema for frame-level detection records
- [ ] Create Mongoose schema for hourly aggregated traffic and risk summaries
- [ ] Persist incoming detection results to MongoDB upon processing
- [ ] Add query endpoint for historical trend analysis

---

## Milestone 8 — Advanced Tracking & Supervised Modeling *(Planned / Conditional)*

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
| 2026-10-27 | Client Updates | Polling over WebSockets | Simpler initial implementation; sufficient for 10-second dashboard refresh intervals. |
| 2026-10-27 | Risk Modeling | Deterministic heuristic for MVP | Evaluated in `dataset-review-and-limitations.md`. Public crash records cannot be spatiotemporally aligned to open video benchmarks without fabricating data. |
