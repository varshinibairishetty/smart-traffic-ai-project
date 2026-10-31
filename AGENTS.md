# AGENTS.md — Operational Guide for AI Coding Assistants

> **Project:** Multimodal AI-Based Smart Traffic Management and Accident Prediction System  
> **Target Audience:** Automated AI assistants, autonomous coding agents, and human developers contributing to this codebase.  
> **Mandatory Rule:** All agents operating inside this repository MUST read, internalize, and strictly adhere to this document before inspecting, modifying, or executing code.

---

## 1. Project Context & Mission

### 1.1 System Purpose
This repository implements the **Multimodal AI-Based Smart Traffic Management and Accident Prediction System**. It is a real-time, local-first platform designed to assist traffic-police control room personnel and municipal traffic authorities in monitoring intersection video, assessing vehicle density, and evaluating accident risk using an explainable deterministic heuristic ($R_t$).

### 1.2 Target Users
The system is built specifically for:
- **Traffic Police Operators:** Monitoring live video feeds, road segment densities, and high-risk alerts in central command rooms.
- **Municipal Traffic Engineers:** Auditing intersection capacity thresholds ($K_{\text{sat}}$), congestion patterns, and historical trends.
- **System Administrators:** Managing role-based access control, surveillance camera metadata, and outgoing municipal notification webhooks.

*Note for AI Assistants:* Do not frame this project as a student project or reference team sizes. Treat the codebase as a professional municipal traffic management system.

### 1.3 Local-First Architecture Principle
The platform is designed to execute completely on a standard local development machine:
- **No Paid APIs:** Do not introduce mandatory third-party paid services (e.g., Google Maps Platform, paid weather APIs, proprietary cloud AI endpoints).
- **No Mandatory Cloud Infrastructure:** Do not require AWS, Azure, GCP, Kubernetes, or container orchestration unless explicitly requested by the user.
- **Standard Runtimes:** The project runs directly via Node.js (`v18+`), standard npm scripts, and Python (`3.10+`).

---

## 2. Module Ownership & Workspace Boundaries

Agents must respect module boundaries and make modifications only in the appropriate directory:

| Module / Layer | Primary Path | Technologies | Core Responsibilities |
|---|---|---|---|
| **Frontend Dashboard** | [`frontend/`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/frontend) | React 18, Vite, React Router, Leaflet, Recharts, Socket.io-client | Single-page operator interface; visualizes vehicle counts, Leaflet live map, camera HUD feeds, persistent incident tables, Recharts analytics, and role-based view controls. |
| **Backend API Gateway** | [`backend/`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/backend) | Node.js, Express.js, Socket.io, JWT, bcryptjs | Coordinates REST endpoints, runs deterministic risk calculation ($R_t$), handles JWT authentication and RBAC guards, manages local atomic JSON stores, and broadcasts real-time WebSocket telemetry. |
| **AI Vision Service** | [`ai-service/`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/ai-service) | Python, FastAPI, Uvicorn, Ultralytics YOLOv8, OpenCV, Pydantic | Ingests video files, decodes frames via OpenCV, runs YOLOv8n vehicle inference, serializes detections via Pydantic, and streams live frame payloads via Socket.io. |
| **Enterprise Persistence** | `MongoDB` (Planned) | Mongoose | Dedicated long-term persistence layer for historical detection logs and hourly traffic rollups. Currently staged via local JSON stores in [`backend/data/`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/backend/data). |
| **Platform Documentation** | [`docs/platform/`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/docs/platform) | Markdown | System architecture, data flow diagrams, API endpoint catalogs, and deployment considerations. |
| **Feature Specifications** | [`docs/feats/`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/docs/feats) | Markdown | Technical specifications for YOLO vehicle detection, dataset reviews, and risk model formulations. |
| **Task Management** | [`docs/tasks.md`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/docs/tasks.md) | Markdown | Phased milestone tracker, implementation checklists, and architectural decisions log. |

---

## 3. Architectural Boundaries & Communication Rules

### 3.1 Separation of Concerns
1. **Frontend Isolation:** The React frontend (`frontend/src/`) must never directly interact with the filesystem or load local video files into native Python runtimes. All external communication must occur via HTTP REST calls (`frontend/src/services/api.js`) or WebSocket subscriptions (`frontend/src/services/socket.js`).
2. **Backend Coordination:** The Express backend (`backend/server.js`) is an API and telemetry coordinator. It must not execute computer vision inference directly or attempt to load neural network weights into Node.js memory.
3. **AI Service Specialization:** The Python AI service (`ai-service/`) handles video decoding and neural network inference. It must remain decoupled from user authentication, frontend sessions, and UI state.
4. **No Duplicate Business Logic:**
   - The authoritative formula for the deterministic risk heuristic ($R_t$) is defined in [`docs/feats/dataset-review-and-limitations.md`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/docs/feats/dataset-review-and-limitations.md).
   - The runtime implementation lives in [`backend/utils/riskCalculator.js`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/backend/utils/riskCalculator.js).
   - The Python reference mirror lives in [`ai-service/risk_calculator.py`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/ai-service/risk_calculator.py).
   - If any parameter, weight ($w_d, w_v, w_m, w_p$), or threshold ($K_{\text{sat}}$) is modified, both files and the corresponding documentation must be updated simultaneously.

### 3.2 Service Communication Channels
- **Synchronous REST:** Used for on-demand queries, authentication (`/api/auth/login`), system healthchecks (`/health`, `/api/health`), camera metadata (`/api/cameras`), and manual incident resolution.
- **Asynchronous WebSocket (Socket.io on port 5000):**
  - Event `push_detection_frame`: Emitted by `ai-service/socket_client.py` and received by `backend/server.js`.
  - Event `live_traffic_update`: Emitted by `backend/server.js` and received by all connected React dashboard clients.
  - Event `resolve_incident`: Emitted by authenticated Admin clients to update incident status.
  - Event `notification_dispatched`: Emitted by the backend when an alert is dispatched across channels.

---

## 4. Feature Development Protocol

Before implementing or editing any feature, agents must follow this sequential protocol:

```
1. Inspect Code & Docs ──▶ 2. Verify Contracts ──▶ 3. Make Incremental Changes
                                                                 │
6. Document Changes   ◀── 5. Run Verification  ◀── 4. Prevent Data Leakage
```

1. **Inspect Before Modifying:**
   - Always read the target file and its local dependencies before editing. Never assume file paths, export shapes, or component props.
   - Review [`docs/tasks.md`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/docs/tasks.md) and [`docs/platform/architecture.md`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/docs/platform/architecture.md) to confirm the scope of planned work.
2. **Preserve Documentation Integrity:**
   - When adding, modifying, or removing an API route, immediately update the endpoint tables in `README.md` and `docs/platform/architecture.md`.
   - Update milestone checkboxes in `docs/tasks.md` when tasks transition from planned to verified.
3. **Incremental and Focused Changes:**
   - Keep code modifications focused strictly on the assigned task. Avoid wide-ranging refactors of working files.
   - Never delete or rename files without explicit user instruction.
4. **Graceful Fallbacks:**
   - Frontend components must gracefully handle network failures, missing detection files, and disconnected WebSockets by displaying fallback sample data without unhandled runtime exceptions.

---

## 5. Computer Vision & Video Ingestion Guidelines

When working in `ai-service/`:

1. **OpenCV Video Ingestion (`detector.py`):**
   - Validate that video paths exist on disk using `pathlib.Path.exists()`.
   - Confirm that `cv2.VideoCapture` successfully opens the video stream using `cap.isOpened()`.
   - Verify video header metadata (fps, total frame count) before beginning sampling.
2. **Model Weight Caching:**
   - Maintain the module-level model cache (`_model` in `detector.py`).
   - The YOLO model must be loaded into memory once during application startup or upon first invocation; **never** reload model weights inside per-frame or per-request loops.
3. **Vehicle Class Filtering:**
   - Restrict vehicle detection outputs strictly to the four approved COCO categories:
     - ID 2: `car`
     - ID 3: `motorcycle`
     - ID 5: `bus`
     - ID 7: `truck`
   - Explicitly reject non-vehicular categories (pedestrians, animals, traffic lights) from vehicle count metrics.
4. **Sampling & Performance:**
   - Use configurable frame sampling (default: process 1 frame every $N = 5$ frames).
   - Enforce maximum frame processing limits (`MAX_FRAMES`) to prevent long-running blocking operations on CPU workstations.
5. **Tracking vs. Detection:**
   - Clearly distinguish between *per-frame detections* (instantaneous visible boxes), *unique tracked vehicles* (persistent IDs across frames), and *throughput* (line-crossing flow).
   - Multi-object tracking (e.g., ByteTrack) is currently **planned**; do not present detection counts as unique tracked vehicles.

---

## 6. Machine Learning & Risk Modeling Guidelines

When working on risk calculation or machine-learning models:

1. **The Spatiotemporal Misalignment Reality:**
   - Agents must understand the fundamental scientific barrier documented in [`docs/feats/dataset-review-and-limitations.md`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/docs/feats/dataset-review-and-limitations.md): public tabular crash databases (UK STATS19, US Accidents) cannot be joined directly with open traffic video benchmarks without fabricating spatial and temporal coordinates.
   - **Strict Prohibition:** Never generate synthetic accident labels, attach fictitious accident probabilities to live video frames, or claim that an unverified supervised model is running in production.
2. **The Validated Heuristic Baseline ($R_t$):**
   - All real-time risk scores in the working prototype must derive from the transparent, deterministic formula:
     $$R_t = \min\left(100, \; 0.55 \cdot D_t + 0.20 \cdot V_{\text{trend}} + 0.15 \cdot M_t + 0.10 \cdot P_t\right)$$
   - Ensure the output is properly clamped between 0 and 100 and mapped to the standard four tiers: Low ($0–34$), Medium ($35–66$), High ($67–84$), and Critical ($85–100$).
3. **Supervised ML Requirements (XGBoost — Planned):**
   - If training a supervised model in future work:
     - Document the exact dataset provenance, collection methodology, and license.
     - Enforce temporal train/validation/test splits to eliminate data leakage.
     - Address extreme class imbalance ($<0.01\%$ collision rate) using cost-sensitive learning or appropriate resampling.
     - Benchmark the model against the deterministic $R_t$ heuristic baseline using Precision-Recall curves (PR-AUC) and Brier calibration scores.

---

## 7. Data Integrity & Categorization Standards

To prevent misleading claims, all data within the application must be categorized into one of four distinct tiers:

1. **Observed CV Data:** Real, empirical outputs extracted directly from video frames by YOLOv8 and OpenCV (e.g., bounding boxes, vehicle classifications, instantaneous counts).
2. **Derived Deterministic Data:** Mathematical transformations calculated from observed metrics using documented, verified formulas (e.g., road density percentage $D_t$, composite risk score $R_t$).
3. **Sample / Fallback Data:** Curated static JSON fixtures (e.g., `frontend/src/data/sampleData.js`) clearly surfaced when backend services are offline.
4. **Presentation Simulation Scenarios:** Explicitly triggered edge-case scenarios (e.g., `HEAVY_CONGESTION`, `MONSOON_FLOODING`, `FIRE_FLYOVER`) loaded via the Simulation Control Panel for live demonstration and evaluation.

*Rule for Agents:* Never blur these boundaries. Never present simulated scenario data as genuine live sensor output.

---

## 8. Security, Privacy & File Handling

1. **Secrets & Environment Variables:**
   - Store all configuration parameters and secret keys in `.env` files.
   - Document all required variables in `.env.example`.
   - Never hardcode JWT secrets, database connection URIs, or private keys into source code or markdown documents.
2. **Password Security:**
   - Passwords stored in `backend/data/users.json` must be hashed using `bcryptjs` with a minimum salt round of 10.
   - Plaintext passwords must never appear in logs, API responses, or error traces.
3. **Role-Based Access Control (RBAC):**
   - Enforce authentication on sensitive endpoints using the `authenticate` middleware.
   - Restrict mutation routes (`/api/incidents/:id/status`, `/api/incidents/:id/resolve`, `/api/demo/scenario`) strictly to users with the `admin` role via `requireRole(['admin'])`.
4. **Input Validation & Path Traversal Prevention:**
   - Validate and sanitize all user-supplied video paths in `ai-service/main.py`.
   - Restrict file uploads and video decoding to supported extensions (`.mp4`, `.avi`, `.mov`).
5. **Surveillance Video Privacy:**
   - Acknowledge that municipal camera feeds capture public individuals and license plates. Document that production deployments must apply local edge blurring and comply with regional privacy regulations.

---

## 9. Dependency Management

1. **Local-First & Zero-Cost:**
   - All runtime dependencies must be open-source and free of licensing fees or monthly service charges.
   - Do not install proprietary cloud SDKs (e.g., AWS Rekognition, Google Cloud Video Intelligence).
2. **Package Hygiene:**
   - Frontend dependencies must be managed in `frontend/package.json`.
   - Backend dependencies must be managed in `backend/package.json`.
   - Python dependencies must be declared in `ai-service/requirements.txt` with version constraints.
   - Before adding any new dependency, verify that the capability cannot be cleanly implemented using existing packages.

---

## 10. Testing & Verification Procedures

After making code changes, agents must execute the relevant verification procedure and review the output:

### 10.1 Frontend Build Check
```powershell
cd frontend
npm run build
```
*Expected Result:* Vite compiles and transforms JSX with zero syntax or bundling errors.

### 10.2 Backend Test Suite Execution
```powershell
cd backend
npm test
```
*Expected Result:* Jest runs all test suites (`riskCalculator.test.js`, `apiEndpoints.test.js`, `auth.test.js`, `notificationService.test.js`).
*Reporting Note:* In sandbox environments on Windows, network socket tests using supertest may report `connect EACCES` due to sandbox port binding rules. Pure mathematical unit tests (`riskCalculator.test.js`) must pass completely.

### 10.3 AI Service Verification
```powershell
cd ai-service
# Standalone detector verification:
python test_detection.py

# Or run pytest:
python -m pytest tests/
```
*Expected Result:* Detections are extracted and exported to `ai-service/detection_output.json`.

---

## 11. Documentation Maintenance Rules

Whenever changes affect system behavior, agents must update the corresponding documentation:

| Code Modification | Target Documentation File |
|---|---|
| Adding, removing, or changing an API route | `README.md` (API Contracts table) & `docs/platform/architecture.md` |
| Changing WebSocket events or payload shapes | `docs/platform/architecture.md` (WebSocket Events table) |
| Altering vehicle detection parameters or classes | `docs/feats/vehicle-detection.md` |
| Modifying the $R_t$ risk heuristic or thresholds | `docs/feats/dataset-review-and-limitations.md` |
| Updating milestone or task progress | `docs/tasks.md` |
| Modifying assistant guidelines or boundaries | `AGENTS.md` |

---

## 12. Prohibited Practices

Agents must NEVER engage in the following prohibited behaviors:

- ❌ **Fabricating Machine Learning Performance:** Never generate synthetic accuracy, precision, recall, or F1 scores and present them as genuine model benchmarks.
- ❌ **Deleting Existing Files Blindly:** Never delete, rename, or overwrite files without reading them first.
- ❌ **Introducing Cloud Overhead:** Never introduce mandatory Docker, Kubernetes, or cloud infrastructure when standard npm/python scripts suffice.
- ❌ **Fabricating Video-Accident Links:** Never claim that public CCTV footage has been joined with historical accident databases when spatiotemporal alignment is absent.
- ❌ **Creating Empty Shell Directories:** Never create empty placeholder directories without accompanying code and documentation.
- ❌ **Hardcoding Secrets:** Never commit real API keys, passwords, or JWT secrets to documentation or code.

---

## 13. Agent Completion Criteria

When completing a user request, the agent must provide a clear and structured report containing:

1. **Files Modified:** Exact list of updated, created, or reviewed files with relative paths.
2. **Implementation Status:** Explicit differentiation between features that are **Verified**, **Implemented**, **Planned**, or **Blocked**.
3. **Verification Results:** Exact commands executed, build outputs, test results, and explanations for any environmental sandbox constraints encountered.
4. **Pending Decisions:** Any unresolved architectural choices or pending milestone dependencies.
5. **Recommended Next Steps:** Clear, actionable next steps for the engineering team.
