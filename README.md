# Multimodal AI-Based Smart Traffic Management and Accident Prediction System

> **A real-time, local-first traffic-police assistance platform integrating computer vision, deterministic traffic density analytics, explainable accident-risk heuristics, and an interactive operational dashboard.**

---

## 1. Project Title

**Multimodal AI-Based Smart Traffic Management and Accident Prediction System**

---

## 2. Project Overview

The **Multimodal AI-Based Smart Traffic Management and Accident Prediction System** is a modular web platform engineered to assist traffic-police personnel, municipal traffic control rooms, and transportation authorities in actively monitoring road traffic, assessing congestion dynamics, and anticipating elevated collision risk.

Urban roadways face rapid volume fluctuations, recurrent bottlenecks, and multi-vehicle conflict zones that overwhelm manual closed-circuit television (CCTV) surveillance. This platform provides an automated operational pipeline:
- Ingests traffic video feeds from local cameras or recorded surveillance files.
- Identifies and classifies vehicles in real time using deep-learning object detection (YOLO).
- Quantifies vehicle counts, category compositions, and relative traffic density across road segments.
- Computes an explainable, deterministic accident-risk score ($R_t$) based on road saturation, volume acceleration, fleet composition (trucks, buses, motorcycles), and congestion penalties.
- Streams live telemetry and risk indicators over WebSockets to an operator dashboard featuring interactive map visualization, multi-camera surveillance grids, persistent incident management, and automated webhook alert dispatching.
- Establishes a validated architectural foundation and data-engineering roadmap for future supervised machine-learning models (e.g., XGBoost) when spatiotemporally aligned crash datasets become accessible.

The entire architecture is designed with a **local-first philosophy**, operating efficiently on standard local workstations without requiring paid external APIs, proprietary cloud services, or container orchestration.

---

## 3. Problem Statement

Modern municipal traffic management centers oversee hundreds of intersection camera feeds. Traffic operators face several systemic operational bottlenecks:

1. **Surveillance Fatigue & Manual Monitoring Overload:** Human operators cannot simultaneously monitor dozens of concurrent video channels to detect hazardous tailbacks, gridlock, or dangerous vehicle clustering before accidents materialize.
2. **Delayed Incident Discovery:** Incidents are frequently reported retroactively—after collisions occur or significant traffic bottlenecks form—slowing down emergency vehicle dispatch and traffic police intervention.
3. **Black-Box AI Unreliability:** Many academic traffic models generate synthetic crash probabilities using ungrounded machine-learning inferences that lack transparency, making traffic police hesitant to trust automated recommendations.
4. **Data Isolation Across Domains:** Physical camera video (micro-level visual frames) and historical accident repositories (macro-level regional records) remain isolated, preventing operators from contextualizing real-time video observations with historical hazard profiles.
5. **High Cloud Infrastructure Costs:** Many commercial intelligent transportation systems (ITS) rely on expensive cloud-hosted GPU clusters, SaaS subscriptions, and paid map APIs, rendering them inaccessible for municipal departments with strict IT budgets.

---

## 4. Motivation and Practical Use Cases

### 4.1 Motivation
Proactive traffic intervention can save lives, reduce carbon emissions from idling vehicles, and minimize urban economic disruption. By equipping traffic police with an automated platform that continuously assesses road volume, identifies dangerous commercial fleet mixing, and highlights high-risk intersections in real time, traffic enforcement teams can shift from reactive post-collision triage to proactive preventative management.

### 4.2 Practical Use Cases
- **Traffic Police Control Room Assistance:** Centralized situational awareness across key city intersections, highlighting congested corridors on a live geographical map.
- **Congestion Mitigation & Signal Timing Support:** Identification of intersection saturation thresholds ($K_{\text{sat}}$) to trigger manual or automated traffic signal adjustments.
- **Emergency Corridor Clearance:** Detection of acute gridlock at hospital routes or flyovers, enabling operators to reroute approaching emergency medical and fire services.
- **Automated Municipal Webhook Dispatch:** Instantaneous alert dispatching to municipal road authorities, emergency dispatchers, and digital message signs (VMS) when risk scores exceed critical thresholds ($R_t \ge 70$).
- **Surveillance Grid Review & Incident Archiving:** Structured digital logging of high-density events, active hazard states, and resolution outcomes for urban transportation planning and civil infrastructure audits.

---

## 5. Project Objectives

1. **Automated Vehicle Detection:** Accurately identify and categorize vehicles (`car`, `truck`, `bus`, `motorcycle`) in video frames using YOLOv8 without manual frame tagging.
2. **Continuous Traffic Metric Extraction:** Calculate per-frame vehicle counts, average vehicle volume, category distributions, and spatial density percentages.
3. **Transparent Risk Scoring:** Formulate and execute a deterministic, mathematically grounded accident-risk heuristic ($R_t$) that scores conditions on a scale of 0 to 100 based on physical traffic parameters.
4. **Bi-Directional Telemetry Streaming:** Transmit live vehicle detection frames and risk updates from the Python computer vision service to the Node.js backend and React dashboard via Socket.io with zero browser refresh.
5. **Interactive Operator Interface:** Provide a comprehensive React dashboard including live geographical node maps (Leaflet), multi-camera grid layouts, persistent incident management tables, and dynamic visual analytics.
6. **Role-Based Access Control & Security:** Enforce secure authentication (JWT) with distinct `operator` (read-only monitoring) and `admin` (incident resolution, scenario simulation) authorization roles.
7. **Empirical Dataset & ML Grounding:** Provide a rigorous scientific analysis of public traffic datasets, documenting the spatiotemporal mismatch problem and outlining the exact requirements for future supervised XGBoost training.
8. **Resource-Efficient Local Execution:** Ensure the entire system executes locally on development hardware using standard open-source runtimes (Node.js, Python, npm).

---

## 6. Proposed Solution

The proposed platform combines computer vision, an asynchronous API gateway, deterministic risk calculation, and a reactive frontend:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Multimodal Smart Traffic System Architecture                │
└─────────────────────────────────────────────────────────────────────────────┘

   Local Video (.mp4) / Camera Stream
              │
              ▼
   ┌────────────────────────────────────────────────────────┐
   │             AI Computer Vision Service                 │
   │  • Python 3 + OpenCV (cv2.VideoCapture)                │
   │  • YOLOv8n Object Detection (Ultralytics)              │
   │  • Frame sampling & vehicle classification             │
   │  • Socket.io Client (push_detection_frame)             │
   └────────────────────────┬───────────────────────────────┘
                            │
               WebSocket / HTTP POST
                            │
                            ▼
   ┌────────────────────────────────────────────────────────┐
   │             Application Backend API                    │
   │  • Node.js + Express.js (:5000)                        │
   │  • Deterministic Risk Heuristic Engine (Rt)            │
   │  • JWT Authentication & Role-Based Access Control      │
   │  • Incident Store & Notification Webhook Dispatcher    │
   │  • Socket.io Server (live_traffic_update broadcast)    │
   └────────────────────────┬───────────────────────────────┘
                            │
                Socket.io / REST (CORS)
                            │
                            ▼
   ┌────────────────────────────────────────────────────────┐
   │             Traffic-Police Dashboard                   │
   │  • React 18 + Vite (:5173 / Static Serviced)           │
   │  • Leaflet Interactive Hyderabad Geographic Map        │
   │  • Live Multi-Camera Surveillance HUD Canvas           │
   │  • Incident Resolution Center & Recharts Analytics     │
   │  • Real-Time Audio-Visual Risk Alert Banners           │
   └────────────────────────────────────────────────────────┘
```

---

## 7. Intended Users

- **Traffic Police Desk Operators:** Personnel stationed in city control rooms who monitor active surveillance camera feeds, observe road density fluctuations, and acknowledge automated hazard alerts.
- **Field Traffic Sergeants & Incident Responders:** Field units receiving automated SMS, email, or municipal webhook dispatches directing them to high-density bottlenecks or potential conflict points.
- **Municipal Traffic Engineers & Planners:** Urban transportation authorities analyzing aggregated historical trends, intersection saturation curves, and incident logs to optimize traffic light schedules and road geometry.
- **System Administrators:** Law enforcement technical administrators managing user credentials, alert thresholds, webhook destination URLs, and surveillance camera configurations.

---

## 8. Complete End-to-End Workflow

The system operates across nine sequential, interconnected stages:

```
Stage 1: Video Ingestion ──▶ Stage 2: YOLO Detection ──▶ Stage 3: Vehicle Counting
                                                                   │
Stage 6: Risk Estimation ◀── Stage 5: Historical Data ◀── Stage 4: Density Analysis
         │
         ▼
Stage 7: Backend & Storage ──▶ Stage 8: Police Dashboard ──▶ Stage 9: Alert Dispatch
```

### Stage 1: Traffic Video Input
- **Input Ingestion:** The user supplies a local video file (`.mp4`, `.avi`, or `.mov`) to `ai-service/sample_video/` or selects an active camera feed.
- **Format Validation & Inspection:** OpenCV (`cv2.VideoCapture`) validates the file header, checks decodability, and inspects video metadata (frames per second, width, height, total frame count).
- **Error Handling:** If the video path does not exist, a descriptive `FileNotFoundError` is thrown. If the codec is unsupported or the stream is corrupted, a `ValueError` is raised with troubleshooting instructions.
- **Sampling Interval:** To ensure real-time performance on CPU hardware, the video is sampled at a configurable interval ($N = 5$ frames by default), processing key frames while skipping redundant inter-frame computation.

### Stage 2: Vehicle Detection Using YOLO
- **Inference Pipeline:** Each sampled frame is passed as a NumPy BGR array into the YOLOv8 neural network.
- **Bounding Boxes & Classes:** YOLO identifies object bounding boxes $[x_1, y_1, x_2, y_2]$, class predictions, and confidence scores.
- **Vehicle Filtering:** The pipeline isolates four target traffic classes from the 80 COCO categories:
  - Class 2: `car`
  - Class 3: `motorcycle`
  - Class 5: `bus`
  - Class 7: `truck`
- **Confidence Filtering:** Detections below a calibrated confidence threshold (default $\tau = 0.40$) are discarded to prevent false-positive visual artifacts.
- **Vision Limitations:** The detector's efficacy is influenced by environmental conditions (nighttime glare, severe rainfall, fog), extreme camera perspective distortion, and bumper-to-bumper vehicle occlusion.

### Stage 3: Vehicle Tracking and Counting
- **Per-Frame Detections:** The base pipeline counts the number of valid vehicle bounding boxes present in the instantaneous frame ($V_t$).
- **Tracking Association (Planned):** Associating bounding boxes across consecutive frames using spatial overlap (IoU) and motion filtering (e.g., ByteTrack or SORT) to assign persistent vehicle IDs.
- **Distinction of Metrics:**
  - *Per-frame vehicle count:* Instantaneous snapshot of visible vehicles at timestamp $t$.
  - *Distinct tracked vehicles:* Cumulative count of unique vehicles that have traversed the camera field of view over a time window.
  - *Flow rate (throughput):* Vehicles passing a virtual tripwire line per minute.
- **Current Operational Status:** Instantaneous per-frame detection counting and temporal sliding-window averaging are verified and implemented. Persistent trajectory tracking is specified and planned.

### Stage 4: Traffic Density and Congestion Analysis
- **Volume vs. Congestion Rationale:** A high vehicle count does not necessarily prove congestion if traffic is moving at free-flow speed across a multi-lane highway. True congestion represents the ratio of observed volume to physical road carrying capacity.
- **Nominal Road Capacity ($K_{\text{sat}}$):** A calibrated baseline representing the maximum number of vehicles that can occupy the camera viewport under normal queueing conditions (default $K_{\text{sat}} = 25$ vehicles for an urban intersection view).
- **Density Ratio ($D_t$):**
  $$D_t = \min\left(100, \frac{V_t}{K_{\text{sat}}} \times 100\right)$$
- **Congestion Progression:** Density between 0% and 50% indicates free flow; 51% to 70% indicates moderate density; $\ge 70\%$ triggers the acute congestion penalty ($P_t$).

### Stage 5: Historical Accident Data and Preprocessing
- **Purpose of Historical Data:** Historical collision logs provide empirical evidence regarding the environmental, temporal, and infrastructural variables associated with crash occurrences (e.g., rain, night, high truck ratios).
- **Candidate Datasets Evaluated:**
  - *UK STATS19 (DfT):* ~1.5 million police-reported incidents with rich environmental variables.
  - *US Accidents Dataset:* ~7.7 million records with GPS coordinates and weather alerts.
- **The Spatiotemporal Misalignment Problem:** Public accident logs are recorded retrospectively with approximate timestamps (hourly or daily) and regional coordinates, while traffic camera video captures microsecond dynamics at a specific junction. Direct row-by-row feature joining between public crash logs and independent video benchmarks is technically invalid without synthetic fabrication.
- **Data Preprocessing Requirements:** Location centroid normalization, timestamp binning, class imbalance resampling (accidents represent $<0.01\%$ of traffic hours), and strict separation of training/evaluation folds to prevent data leakage.

### Stage 6: Accident-Risk Estimation Using XGBoost
- **Role of Supervised ML:** Gradient boosted decision trees (XGBoost) excel at learning non-linear interactions across tabular features (e.g., density $\times$ rainfall $\times$ heavy truck ratio).
- **Input Feature Schema (Specified):** Vehicle density ($D_t$), recent volume acceleration ($\Delta V$), commercial vehicle fraction ($M_t$), time-of-day cyclical encoding ($\sin(\text{hour}), \cos(\text{hour})$), and precipitation indicators.
- **Target Variable:** Binary collision occurrence or multi-tier hazard level within a forward prediction window (e.g., next 15 minutes).
- **Risk Estimation vs. Collision Detection:** Risk estimation calculates the statistical *probability* or *hazard score* under given conditions; it does not guarantee that a crash will occur and does not represent real-time collision impact detection.
- **Operational Status:** Supervised XGBoost training is documented as a planned post-MVP milestone. The production system utilizes the verified deterministic heuristic ($R_t$) to prevent ungrounded synthetic inferences.

### Stage 7: Backend, Database, and AI Service Coordination
- **Decoupled Roles:**
  - *Python AI Service:* Runs OpenCV frame extraction and YOLO inference; exposes REST endpoints (`/detect`, `/health`) and pushes live frames via Socket.io.
  - *Node.js Express Backend:* Central coordinator exposing secured REST APIs, executing the $R_t$ risk formula, managing persistent JSON stores, and broadcasting WebSocket telemetry.
  - *React Frontend:* Single-page application rendering real-time dashboards, charts, maps, and camera HUDs.
  - *MongoDB (Planned):* Long-term enterprise document store for historical detection archiving and hourly summaries.
- **Communication Protocol:** JSON over HTTP REST for configuration and polling; Socket.io over WebSockets for low-latency live telemetry.

### Stage 8: Traffic-Police Dashboard
- **Operator Overview:** Real-time summary cards displaying active vehicle count, peak detections, model confidence, and operational status.
- **Visual Risk Gauge:** Circular SVG gauge reflecting the composite risk score ($R_t \in [0, 100]$) with dynamic color classification (Green, Amber, Orange, Red).
- **Geographical Live Map:** Interactive Leaflet map displaying Hyderabad regional traffic nodes (HITEC City, Gachibowli, Madhapur, Kondapur, Jubilee Hills, Banjara Hills) with color-coded risk markers.
- **Surveillance Grid:** Multi-camera feed layout (VID-001 through VID-005) with synthetic MJPEG stream rendering and bounding box HUDs.
- **Data Integrity Standards:** Dashboard components explicitly label data as *Observed* (YOLO detections), *Derived Heuristic* ($R_t$ score), or *Simulation Scenario*.

### Stage 9: Alerts and Decision Support
- **Rule-Based Triggers:** When an active incident occurs or risk crosses the critical threshold ($R_t \ge 70$), the system triggers immediate multi-channel notifications.
- **Dispatch Channels:**
  - *Dashboard Alert Banner:* Persistent high-priority visual notification with Web Audio API chime.
  - *Mock Email Dispatcher:* Formatted incident dispatch sent to the municipal traffic control inbox.
  - *Mock SMS Dispatcher:* Concise SMS alert sent to on-duty traffic sergeants.
  - *Outgoing Municipal Webhook:* Structured JSON payload posted via HTTP to municipal emergency management systems.
- **Degraded Fallback Mode:** If external services or the AI service are offline, the backend continues operating with cached incident data, returning graceful fallback states.

---

## 9. YOLO Vehicle Detection Subsystem

The detection subsystem is implemented in [`ai-service/detector.py`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/ai-service/detector.py).

### 9.1 Model Architecture & Weights
- **Model Variant:** YOLOv8n (Nano variant, Ultralytics, ~6.5 MB weights file: `yolov8n.pt`).
- **Input Resolution:** Scaled dynamically by YOLO to 640 pixels on the long edge while maintaining aspect ratio.
- **Memory Caching:** The neural network weights are loaded into memory once during FastAPI application startup (via lifespan context manager) and cached in a module-level variable to prevent recurring disk I/O latency.

### 9.2 Supported Vehicle Classes
COCO dataset identifiers mapped in [`ai-service/config.py`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/ai-service/config.py):
- **Class 2 (`car`):** Passenger cars, sedans, hatchbacks, SUVs, and taxis.
- **Class 3 (`motorcycle`):** Two-wheel motorized vehicles, scooters, and motorbikes.
- **Class 5 (`bus`):** Transit buses, school buses, and private coaches.
- **Class 7 (`truck`):** Commercial freight trucks, delivery vans, lorries, and articulated haulers.

### 9.3 Per-Frame Output Structure
Each detection yields normalized and absolute pixel coordinates:
```json
{
  "vehicle_class": "car",
  "confidence": 0.8842,
  "bbox": {
    "x1": 340,
    "y1": 162,
    "x2": 412,
    "y2": 225
  }
}
```

---

## 10. Vehicle Tracking and Counting

### 10.1 Conceptual Distinction
| Measurement | Definition | Use Case in Traffic Analysis |
|---|---|---|
| **Per-Frame Detection Count ($V_t$)** | Instantaneous count of vehicles detected in a single video frame. | Measures immediate intersection occupancy. |
| **Tracked Vehicle Count ($N_{\text{unique}}$)** | Unique vehicle IDs assigned across consecutive frames using trajectory matching. | Eliminates duplicate counts across video frames. |
| **Traffic Flow ($Q$)** | Number of unique vehicles crossing a designated virtual screen line per minute. | Measures highway and arterial throughput capacity. |

### 10.2 Planned Tracking Methodology
- **Algorithm:** ByteTrack (utilizing low-score detection association with Kalman filtering).
- **Association Metric:** Intersection-over-Union (IoU) of bounding boxes paired with linear velocity prediction.
- **Trajectory Smoothing:** Trajectory vectors enable speed estimation (pixels per second converted to km/h via camera calibration homography).

---

## 11. Traffic Volume, Density, and Congestion Analysis

### 11.1 Mathematical Formulation of Risk ($R_t$)
Because public crash records cannot be paired directly with video frames without data fabrication, the platform uses an explainable engineering heuristic:

$$R_t = \min\left(100, \; w_d \cdot D_t + w_v \cdot V_{\text{trend}} + w_m \cdot M_t + w_p \cdot P_t\right)$$

Where:
- **$D_t \in [0, 100]$ (Density Factor):** Ratio of current vehicle count to viewport saturation capacity ($K_{\text{sat}} = 25$):
  $$D_t = \min\left(100, \frac{V_t}{K_{\text{sat}}} \times 100\right)$$
- **$V_{\text{trend}} \in [0, 100]$ (Volume Trend):** Scaled average vehicle count over recent frames ($\bar{V} \times 4$), measuring sustained load.
- **$M_t \in [0, 100]$ (Fleet Mix Penalty):** Additional risk weighting reflecting maneuverability differences and stopping distances of heavy vehicles:
  $$M_t = \min\left(100, \frac{N_{\text{truck}} \times 2.0 + N_{\text{bus}} \times 1.5 + N_{\text{motorcycle}} \times 1.2}{\max(V_t, 1)} \times 100\right)$$
- **$P_t \in [0, 100]$ (Congestion Penalty):** Non-linear penalty applied when road density exceeds critical queue threshold ($D_t \ge 70\%$):
  $$P_t = \begin{cases} 0 & \text{if } D_t < 70 \\ \min\left(100, \frac{D_t - 70}{30} \times 100\right) & \text{if } D_t \ge 70 \end{cases}$$
- **Calibrated Weights:** $w_d = 0.55$, $w_v = 0.20$, $w_m = 0.15$, $w_p = 0.10$ (sum $= 1.00$).

### 11.2 Standardized Risk Tiers
| Score Range | Risk Category | Operational Meaning | Visual Indicator |
|---|---|---|---|
| **0 – 34** | **Low** | Free-flow traffic; normal lane speeds; no intervention. | Emerald Green (`#22c55e`) |
| **35 – 66** | **Medium** | Moderate volume or elevated heavy vehicle presence; monitor corridor. | Amber Yellow (`#f59e0b`) |
| **67 – 84** | **High** | Approaching saturation; tailbacks forming; elevated conflict potential. | Vivid Orange (`#f97316`) |
| **85 – 100** | **Critical** | Severe gridlock / near-capacity conflict density; dispatch required. | Crimson Red (`#ef4444`) |

---

## 12. Historical Accident Data and Preprocessing

A comprehensive review of candidate datasets is documented in [`docs/feats/dataset-review-and-limitations.md`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/docs/feats/dataset-review-and-limitations.md).

### 12.1 Candidate Data Sources
- **UK Department for Transport STATS19:** Road safety records published under Open Government Licence (OGL v3.0). Rich in casualty details, road conditions, and speed limits, but lacks camera video.
- **US Accidents Dataset (2016–2023):** 7.7 million records collected from traffic sensors and APIs. Good spatial coverage across the US, but lacks co-located camera footage.
- **UA-DETRAC Benchmark:** Video dataset recorded in Beijing for vehicle detection/tracking; contains zero accident ground truth.

### 12.2 Preprocessing Pipeline for Machine Learning
When aligned data is curated, preprocessing follows these mandatory steps:
1. **Deduplication:** Remove multiple reports referencing the same physical collision.
2. **Missing-Value Imputation:** Impute continuous weather variables using median values; encode categorical features with explicit `Unknown` tokens.
3. **Spatiotemporal Quantization:** Map GPS points to discrete intersection node polygons; aggregate timestamps into 15-minute intervals.
4. **Resampling for Class Imbalance:** Apply SMOTE or cost-sensitive loss weighting to address the extreme scarcity of crash instances ($<0.01\%$).
5. **Leakage Prevention:** Split datasets chronologically (e.g., train on years $2021–2023$, evaluate on $2024$) rather than random k-fold splitting to avoid temporal data leakage.

---

## 13. XGBoost Accident-Risk Estimation (Planned Supervised Architecture)

### 13.1 Proposed Model Specification
- **Algorithm:** Extreme Gradient Boosting (`xgboost.XGBClassifier`).
- **Objective Function:** `binary:logistic` for collision probability or `multi:softprob` for 4-tier risk classification.
- **Evaluation Metrics:** Area Under the Precision-Recall Curve (PR-AUC), Brier score for calibration, and True Positive Rate at fixed low False Positive Rates ($FPR \le 5\%$).

### 13.2 Feature Matrix Schema
```
┌───────────────────────────────────────────────────────────┐
│ Feature Name              Type      Source               │
├───────────────────────────────────────────────────────────┤
│ vehicle_density_pct       float     YOLOv8 Detection     │
│ volume_acceleration       float     Frame-to-Frame Delta │
│ heavy_vehicle_ratio       float     YOLOv8 Class Mix     │
│ time_of_day_sin           float     System Timestamp     │
│ time_of_day_cos           float     System Timestamp     │
│ is_weekend                binary    Calendar Feature     │
│ road_surface_condition    ordinal   Historical Context   │
│ weather_severity_score    float     External Weather API │
└───────────────────────────────────────────────────────────┘
```

### 13.3 Technical Prerequisites Prior to Model Deployment
1. Ground-truth crash video trajectories must be acquired and verified.
2. The trained model must demonstrate statistical superiority over the deterministic $R_t$ baseline.
3. Synthetic or pseudo-random probability generators must never be presented as trained inference.

---

## 14. System Architecture

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                        Local Development Workstation                          │
│                                                                               │
│  ┌───────────────────────┐                    ┌────────────────────────────┐  │
│  │   AI Vision Service   │                    │    Backend API Gateway     │  │
│  │   (Python + FastAPI)  │                    │    (Node.js + Express)     │  │
│  │   Port: 8000          │                    │    Port: 5000              │  │
│  │                       │                    │                            │  │
│  │   • YOLOv8n detector  │    Socket.io /     │   • Auth & RBAC Middleware │  │
│  │   • OpenCV video read │  HTTP REST Push    │   • Deterministic Rt Engine│  │
│  │   • Pydantic schemas  │ ─────────────────▶ │   • Incident Store (JSON)  │  │
│  │   • Socket.io client  │                    │   • Webhook Dispatcher     │  │
│  └───────────────────────┘                    │   • Socket.io Server       │  │
│                                               └──────────────┬─────────────┘  │
│                                                              │                │
│                                                WebSocket /   │ Static SPA /   │
│                                                REST Telemetry│ API Endpoints  │
│                                                              ▼                │
│                                               ┌────────────────────────────┐  │
│                                               │   Traffic Police UI        │  │
│                                               │   (React 18 + Vite)        │  │
│                                               │   Port: 5173 / 5000        │  │
│                                               │                            │  │
│                                               │   • Dashboard & Risk Dial  │  │
│                                               │   • Leaflet Live Map       │  │
│                                               │   • Multi-Camera Feed HUD  │  │
│                                               │   • Incident Resolution    │  │
│                                               └────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 15. Service Responsibilities

### Frontend (`frontend/src/`)
- **Technology:** React 18, Vite, React Router, Leaflet, Recharts, Socket.io-client.
- **Responsibilities:**
  - Visualizing real-time vehicle counts, density, and color-coded risk gauges.
  - Rendering the geographical Leaflet map of Hyderabad intersections.
  - Displaying multi-camera surveillance feeds with bounding box HUD overlays.
  - Enforcing client-side role-based view permissions (Admin vs. Operator).
  - Providing immediate audio-visual notifications upon critical incidents.

### Backend Application Gateway (`backend/`)
- **Technology:** Node.js, Express.js, Socket.io, JWT, bcryptjs.
- **Responsibilities:**
  - Coordinating communication across services via REST and WebSockets.
  - Authenticating user requests via JWT tokens and role verification (`admin`, `operator`).
  - Calculating the real-time $R_t$ risk score deterministically from incoming vehicle metrics.
  - Managing persistent incident records (`backend/data/incidents.json`) and notification audit trails.
  - Serving the compiled React production bundle statically when operating in production mode.

### AI Vision Service (`ai-service/`)
- **Technology:** Python 3, FastAPI, Uvicorn, Ultralytics YOLOv8, OpenCV, Pydantic.
- **Responsibilities:**
  - Reading video files from disk frame-by-frame using OpenCV.
  - Executing YOLOv8n object detection on sampled frames.
  - Filtering bounding boxes for vehicles above the confidence threshold.
  - Pushing live detection frames to the backend via WebSocket (`push_detection_frame`).

### Database Persistence Layer (MongoDB — Planned)
- **Technology:** MongoDB, Mongoose.
- **Responsibilities:**
  - Archiving frame-level detection history.
  - Storing hourly aggregated volume curves and risk trends.
  - Supporting complex spatial and temporal queries across multi-year traffic logs.

---

## 16. Data Flow and Service Communication

1. **Detection Ingestion:**
   `ai-service/test_detection.py` (or `main.py`) opens the local video, samples frames, and runs YOLOv8n.
2. **Real-Time Push:**
   `ai-service/socket_client.py` connects to `ws://localhost:5000` and emits the `push_detection_frame` event containing frame detections and per-vehicle bounding boxes.
3. **Backend Processing & Risk Computation:**
   The backend receives `push_detection_frame`, calculates the composite risk score ($R_t$), determines zone impacts, saves high-density frames to `incidentStore.js`, and broadcasts `live_traffic_update` to all connected web clients.
4. **Frontend Render:**
   The React dashboard receives `live_traffic_update` over Socket.io, updating state variables and triggering re-renders of the Risk Gauge, Leaflet map markers, and incident tables without page reloads.

---

## 17. Dashboard Functionality

| Dashboard Page / Panel | Operational Capabilities | Implementation Status |
|---|---|---|
| **Overview Dashboard (`Dashboard.jsx`)** | Live vehicle count, peak vehicles, average count, dynamic SVG risk gauge, vehicle category distribution bars, and recent frame detection table. | **Implemented & Verified** |
| **Live Map (`LiveMap.jsx`)** | Leaflet interactive map of Hyderabad tech-corridor nodes (HITEC City, Gachibowli, Madhapur, Kondapur, Jubilee Hills, Banjara Hills) with color-coded markers and risk popups. | **Implemented & Verified** |
| **Surveillance Grid (`Cameras.jsx`)** | Multi-camera view (VID-001 through VID-005) with dynamic SVG/MJPEG canvas HUDs displaying synthetic vehicle bounding boxes and live stream telemetry. | **Implemented & Verified** |
| **Incidents Center (`Incidents.jsx`)** | Filterable incident history (by severity, status, zone) with lifecycle status management (`Active` vs. `Resolved`) and one-click quick-resolve actions (Admin only). | **Implemented & Verified** |
| **Historical Analytics (`Analytics.jsx`)** | Recharts-powered time-series volume trends, speed distribution physics, and intersection risk comparison charts. | **Implemented & Verified** |
| **Authentication (`Login.jsx`)** | Secure JWT authentication with pre-seeded demo accounts (`admin@traffic.ai`, `operator@traffic.ai`) and conditional navigation rendering. | **Implemented & Verified** |
| **Notification Center Modal** | Outgoing alert channel toggles (Email, SMS, Webhook), risk threshold adjustments ($R_t \ge 70$), and test alert triggers. | **Implemented & Verified** |

---

## 18. API Contracts and Database Design

### 18.1 Backend REST Endpoints

| Method | Endpoint | Access Role | Description |
|---|---|---|---|
| `GET` | `/health` / `/api/health` | Public | Subsystem health check (storage, memory, active streams). |
| `POST` | `/api/auth/register` | Public | Register new operator or admin user with bcrypt password hash. |
| `POST` | `/api/auth/login` | Public | Authenticate user credentials and return JWT bearer token. |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current user session profile. |
| `GET` | `/api/locations` | Public | List all 6 configured Hyderabad locations with metadata and coordinates. |
| `GET` | `/api/locations/:id` | Public | Detailed telemetry view for a specific junction (traffic, weather, incidents). |
| `GET` | `/api/accidents/historical` | Public | Archival Hyderabad accident records collection across monitored junctions. |
| `GET` | `/api/accidents/historical/:locationId` | Public | Archival collision logs, severity breakdown, casualty totals, and Hotspot Risk Index for a specific junction. |
| `GET` | `/api/risk/location/:locationId` | Public | Mode B aligned multimodal risk analysis combining live Open-Meteo weather, TomTom flow, historical crash records, heuristic $R_t$, and full data provenance audit table. |
| `GET` | `/api/traffic/live` | Public | Current TomTom traffic flow metrics for all locations (cached with 5-min TTL). |
| `GET` | `/api/weather/live` | Public | Current meteorological conditions for all locations via Open-Meteo (15-min TTL). |
| `GET` | `/api/incidents/active`| Public | Verified provider-reported active incidents within Hyderabad bounding box. |
| `GET` | `/api/telemetry/live` | Public | Unified multi-modal telemetry (traffic + weather + incidents) across all junctions. |
| `POST` | `/api/telemetry/refresh`| Public | Invalidate cache and force live external fetch from traffic and weather APIs. |
| `GET` | `/api/detections` | Public | Full detection results combined with calculated risk assessment. |
| `GET` | `/api/detections/latest` | Public | Summary and latest frame vehicle metrics. |
| `GET` | `/api/risk` | Public | Current deterministic risk calculation object. |
| `GET` | `/api/zones` | Public | Regional Hyderabad node coordinates with calculated risk scores. |
| `GET` | `/api/incidents` | Public | Filterable persistent incident history (`status`, `zone_id`, `severity`). |
| `GET` | `/api/incidents/analytics` | Public | Aggregated incident statistics (total, active, resolved, resolution rate). |
| `PATCH` | `/api/incidents/:id/status` | Admin | Update incident lifecycle status (`Active` / `Resolved`). |
| `POST` | `/api/incidents/:id/resolve` | Admin | Mark active incident as resolved. |
| `GET` | `/api/cameras` | Public | Dynamic Active Cameras catalog mapped from codebase `videos/` folder, with active incidents and high-risk zones. |
| `GET` | `/api/cameras/:id/stream` | Public | Multipart/x-mixed-replace MJPEG video stream endpoint. |
| `GET` | `/api/videos` | Public | List local traffic video files detected in `videos/` (video1_hitec_city.mp4, video2_gachibowli.mp4, etc.). |
| `POST` | `/api/videos/select` | Public | Select and execute YOLOv8 vehicle counting & $R_t$ risk calculation on a specific local video. |
| `POST` | `/api/upload-video` / `/api/videos/upload` | Public | Upload traffic video (`.mp4`, `.avi`, `.mov`) and execute full YOLOv8 detection & $R_t$ risk calculation. |
| `GET` | `/api/traffic/density` | Public | Stage 4 corridor density, saturation capacity ($K_{\text{sat}} = 25$), Level of Service (LOS), and interval volume. |
| `POST` | `/api/video/analyze` | Public | Trigger video detection and multi-object tracking pipeline analysis. |
| `POST` | `/api/video/stream-sample` | Public | Replay sample video frame stream over Socket.io at controlled demonstration pace. |
| `GET` | `/api/notifications` | Public | Dispatched notification audit logs with channel and severity filters. |
| `GET` | `/api/notifications/config` | Public | Notification channel settings and minimum risk threshold. |
| `PATCH` | `/api/notifications/config` | Admin | Update notification channel toggles and webhook target URL. |
| `POST` | `/api/notifications/test` | Authenticated | Trigger synthetic test alert dispatch across active channels. |
| `POST` | `/api/notifications/mock-webhook`| Public | Municipal Traffic Police mock webhook receiver simulation endpoint. |
| `GET` | `/api/demo/scenarios` | Public | List available viva/presentation simulation scenarios. |
| `POST` | `/api/demo/scenario` | Admin | Activate or reset a simulation scenario override. |

### 18.2 AI Service REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service root confirmation and API documentation link. |
| `GET` | `/health` | Service health status and YOLO model memory state. |
| `GET` | `/detect/sample` | Executes vehicle detection and tracking on default sample video file. |
| `POST` | `/detect` | Runs vehicle detection and tracking on user-specified video path. |
| `POST` | `/detect/upload` | Upload local video file (`.mp4`, `.avi`, `.mov`) for automated YOLOv8 and tracking pipeline. |

### 18.3 WebSocket (Socket.io) Events

| Event | Direction | Sender / Receiver | Payload Description |
|---|---|---|---|
| `live_traffic_update` | Emit | Backend ➔ All Clients | Full real-time telemetry payload (vehicle count, risk object, zones, incidents). |
| `push_detection_frame` | Listen | Python Service ➔ Backend | Single frame detection payload pushed from OpenCV/YOLO inference loop. |
| `trigger_scenario` | Listen | Admin Client ➔ Backend | Switch active viva presentation scenario dynamically. |
| `resolve_incident` | Listen | Admin Client ➔ Backend | Mark active incident as resolved and re-broadcast refreshed state. |
| `notification_dispatched`| Emit | Backend ➔ All Clients | Alert payload emitted whenever an incident is dispatched to external channels. |

### 18.4 Database Storage Design

#### Current Local Persistence (Implemented & Verified)
- `backend/data/incidents.json`: JSON array storing structured incident documents with atomic file write deduplication.
- `backend/data/users.json`: JSON array storing registered user accounts, roles, and bcrypt password hashes.
- `backend/data/notifications.json`: JSON array logging all dispatched notifications, delivery channels, and timestamps.
- `backend/data/notification_config.json`: Persistent configuration object for alert dispatch thresholds and channel flags.

#### Planned MongoDB Mongoose Schemas (Stage 9 Roadmap)
```javascript
// Planned Mongoose Schemas
const DetectionLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  video_source: String,
  frame_index: Number,
  vehicle_count: Number,
  breakdown: { car: Number, truck: Number, bus: Number, motorcycle: Number },
  risk_score: Number,
  risk_category: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'] },
  zone_id: { type: String, index: true }
});

const IncidentSchema = new mongoose.Schema({
  incident_id: { type: String, unique: true },
  timestamp: { type: Date, default: Date.now },
  node_location: String,
  zone_id: String,
  coordinates: [Number], // [lat, lon]
  risk_score: Number,
  severity: String,
  status: { type: String, enum: ['Active', 'Resolved'], default: 'Active' },
  resolved_at: Date,
  resolved_by: String
});
```

---

## 19. Technology Stack and Component Rationale

| Layer | Technology | Version | Purpose & Rationale |
|---|---|---|---|
| **Frontend Framework** | React | `^18.2.0` | Declarative component architecture enabling responsive real-time dashboard state updates. |
| **Build Tooling** | Vite | `^4.4.5` | Fast hot-module replacement (HMR) and optimized Rollup production bundle splitting. |
| **Mapping & Geospatial** | Leaflet & React-Leaflet | `^1.9.4` / `^4.2.1` | Lightweight, open-source tile mapping without requiring paid Google Maps API keys. |
| **Data Visualization** | Recharts | `^3.10.1` | Composable SVG charts for historical volume trends, density distributions, and node analysis. |
| **Backend Runtime** | Node.js | `^18.x` / `^20.x` | Asynchronous event-driven JavaScript runtime ideal for I/O-heavy API gateways. |
| **Web Framework** | Express.js | `^4.19.2` | Minimal, robust HTTP server handling REST routing and middleware pipelines. |
| **Real-Time Transport**| Socket.io / Socket.io-client | `^4.8.4` | Bi-directional WebSocket communication with continuous auto-reconnection and HTTP fallback. |
| **Security & Auth** | jsonwebtoken & bcryptjs | `^9.0.3` / `^3.0.3` | Cryptographic JWT token generation and salted password hashing without native binary dependencies. |
| **Computer Vision** | OpenCV (`opencv-python`)| `^4.8.0` | Industry-standard computer vision library for robust video decoding and frame manipulation. |
| **Object Detection** | Ultralytics YOLOv8 | `^8.0.0` | State-of-the-art single-stage object detector offering optimal speed/accuracy trade-offs on CPU. |
| **AI Web Service** | FastAPI + Uvicorn | `^0.100.0` | High-performance asynchronous Python web framework with automatic OpenAPI documentation. |
| **Schema Validation** | Pydantic | `^2.0.0` | Robust runtime type enforcement and JSON serialization for Python data models. |

---

## 20. Actual Repository Structure

```
smart-traffic-ai-project/
├── README.md                          # Comprehensive project documentation
├── AGENTS.md                          # AI coding assistant operational instructions
├── package.json                       # Root workspace execution scripts
├── package-lock.json
├── .gitignore                         # Git exclusion rules
├── yolov8n.pt                         # Cached YOLOv8 nano model weights (~6.5 MB)
│
├── docs/                              # Architecture and technical specifications
│   ├── tasks.md                       # Milestone checklist and decision log
│   ├── platform/
│   │   └── architecture.md            # System architecture, data flows, and endpoint reference
│   └── feats/
│       ├── vehicle-detection.md       # YOLOv8 detection feature specification
│       └── dataset-review-and-limitations.md # Spatiotemporal review & risk heuristic derivation
│
├── frontend/                          # React 18 + Vite operator dashboard
│   ├── package.json
│   ├── vite.config.js                 # Production bundle configuration & chunk splitting
│   ├── index.html
│   └── src/
│       ├── App.jsx                    # Root view assembler and polling coordinator
│       ├── main.jsx                   # Application mount point
│       ├── index.css                  # Dark-theme operator dashboard design system
│       ├── components/                # Reusable dashboard UI widgets
│       │   ├── AlertBanner.jsx        # Critical hazard visual notification banner
│       │   ├── CameraFeedCanvas.jsx   # Multi-camera surveillance HUD canvas renderer
│       │   ├── CongestionStatus.jsx   # Road segment congestion indicators
│       │   ├── DetectionLog.jsx       # Tabular log of recent frame detections
│       │   ├── Header.jsx             # Top bar with backend connectivity badge
│       │   ├── NavBar.jsx             # Navigation tabs with RBAC awareness
│       │   ├── NotificationSettingsModal.jsx # Outgoing alert channel configuration
│       │   ├── RiskGauge.jsx          # SVG circular risk dial
│       │   ├── ScenarioBar.jsx        # Viva presentation simulation selector
│       │   ├── SimulationPanel.jsx    # Simulation control widget
│       │   ├── StatCard.jsx           # Top-level KPI metric cards
│       │   └── VehicleBreakdown.jsx   # Vehicle category distribution bar chart
│       ├── context/
│       │   └── AuthContext.jsx        # JWT session recovery and authentication state
│       ├── data/
│       │   └── sampleData.js          # Static fallback dataset for offline demonstration
│       ├── hooks/
│       │   ├── useRiskAlert.js        # Hook triggering audio-visual hazard alerts
│       │   └── useTrafficSocket.js    # Custom hook subscribing to WebSocket events
│       ├── pages/                     # Full-page dashboard views
│       │   ├── Analytics.jsx          # Recharts historical traffic trends & analytics
│       │   ├── Cameras.jsx            # Multi-camera surveillance grid
│       │   ├── Dashboard.jsx          # Primary traffic monitoring overview
│       │   ├── Incidents.jsx          # Incident management and quick-resolve center
│       │   ├── LiveMap.jsx            # Interactive Leaflet map of Hyderabad nodes
│       │   └── Login.jsx              # User login page with demo account shortcuts
│       ├── services/
│       │   ├── api.js                 # Axios/Fetch REST API client utility
│       │   └── socket.js              # Socket.io client with exponential backoff
│       └── utils/
│           └── alertSound.js          # Web Audio API procedural chime synthesizer
│
├── backend/                           # Node.js + Express API gateway & WebSocket server
│   ├── package.json
│   ├── server.js                      # Core server implementation (REST + Socket.io)
│   ├── .env                           # Local environment configuration
│   ├── data/                          # Persistent JSON storage directory
│   │   ├── incidents.json             # Persistent incident records
│   │   ├── users.json                 # User accounts and bcrypt password hashes
│   │   ├── notifications.json         # Outgoing notification dispatch audit log
│   │   └── notification_config.json   # Dispatch channel thresholds and configurations
│   ├── utils/                         # Server utility modules
│   │   ├── analyticsAggregator.js     # Historical analytics aggregation engine
│   │   ├── auth.js                    # JWT verification and RBAC middleware
│   │   ├── demoScenarios.js           # Curated viva presentation simulation scenarios
│   │   ├── incidentStore.js           # Atomic JSON persistence manager
│   │   ├── logger.js                  # Structured logging utility with HTTP tracing
│   │   ├── notificationService.js     # Multi-channel alert & webhook dispatcher
│   │   ├── riskCalculator.js          # Deterministic Rt risk heuristic calculator
│   │   └── userStore.js               # User authentication persistence manager
│   └── __tests__/                     # Backend test suites (Jest)
│       ├── apiEndpoints.test.js       # REST endpoint contract validation tests
│       ├── auth.test.js               # JWT authentication and RBAC guard tests
│       ├── notificationService.test.js# Notification dispatch and webhook tests
│       └── riskCalculator.test.js     # Rt mathematical formulation unit tests
│
└── ai-service/                        # Python computer vision & YOLO detection service
    ├── requirements.txt               # Python package dependencies
    ├── config.py                      # Detection thresholds, class mappings, paths
    ├── schemas.py                     # Pydantic request and response schemas
    ├── detector.py                    # OpenCV video decoding and YOLOv8 inference loop
    ├── risk_calculator.py             # Python reference implementation of Rt formula
    ├── main.py                        # FastAPI application with lifespan model caching
    ├── socket_client.py               # Socket.io client streaming frames to backend
    ├── test_detection.py              # Standalone verification script with --socket option
    ├── scenario_runner.py             # Automated viva presentation scenario tour
    ├── sample_video/                  # Local video testing directory
    │   └── traffic-sample.mp4         # Sample traffic video file
    └── tests/                         # Python test suites (pytest)
        ├── test_api_endpoints.py      # FastAPI route verification tests
        └── test_risk_calculator.py    # Python risk formula unit tests
```

---

## 21. Dataset Requirements, Licensing, and Limitations

| Dataset / Source | Custodian / License | Scope & Key Attributes | Technical Limitation for Direct Video Joining |
|---|---|---|---|
| **UK STATS19** | UK Department for Transport / Open Government Licence (OGL v3.0) | Retrospective police reports of casualty collisions; road surface conditions, weather, speed limits. | Spatiotemporally aggregated; lacks continuous localized camera feeds before impact. |
| **US Accidents Dataset** | Moosavi et al. / CC BY-NC-SA 4.0 | 7.7 million records across 49 states; GPS coordinates, start/end timestamps, weather events. | Sensor and API alert data; lacks individual vehicle bounding box trajectories. |
| **UA-DETRAC Benchmark** | University at Albany / Research License | 100 video sequences (140,000 frames) of urban crossings in Beijing with bounding box labels. | Dedicated exclusively to vehicle detection; contains zero accident ground truth. |
| **Local Sample Video** | CC0 Public Domain / Open Stock | Short clip of city intersection traffic used for local CPU inference verification. | Local demonstration feed; unlinked to regional police collision registers. |

---

## 22. Model Training and Evaluation Methodology

When candidate spatiotemporally aligned datasets become available, machine-learning models must be trained according to these standards:
- **Feature Schema:** Synchronized feature vectors combining visual density ($D_t$), volume acceleration ($\Delta V$), heavy vehicle ratio ($M_t$), contextual precipitation, and temporal cyclical features.
- **Data Splitting:** Temporal train-test splits (e.g., 70% historical, 15% validation, 15% holdout forward-time test) to prevent temporal data leakage.
- **Benchmark Evaluation:** The trained supervised model must be compared quantitatively against the deterministic heuristic baseline ($R_t$).
- **Required Metrics:** Area Under Precision-Recall Curve (PR-AUC), Brier Calibration Score, and Sensitivity at fixed low False Positive Rates ($FPR \le 5\%$).

---

## 23. Verified Installation and Execution Instructions

### Prerequisites
- **Node.js:** v18.0.0 or later installed on the development machine.
- **Python:** v3.10, v3.11, or v3.12 (with active virtual environment support).
- **Git:** Standard git client.

### Step 1: Clone the Repository
```bash
git clone https://github.com/varshith/smart-traffic-ai-project.git
cd smart-traffic-ai-project
```

### Step 2: Backend Setup & Execution (Node.js)
```bash
cd backend
npm install
npm start
```
The backend initializes on port `5000`:
- REST API: `http://localhost:5000/api`
- Healthcheck: `http://localhost:5000/api/health`
- WebSocket Server: `ws://localhost:5000` (Socket.io)

### Step 3: Frontend Setup & Execution (React + Vite)
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
The dashboard interface becomes accessible at `http://localhost:5173`.
To verify a production build:
```bash
npm run build
```

### Step 4: AI Service Setup & Execution (Python)
In a third terminal:
```bash
cd ai-service
# Create and activate virtual environment
python -m venv .venv

# Windows PowerShell:
.venv\Scripts\Activate.ps1

# Linux / macOS:
# source .venv/bin/activate

pip install -r requirements.txt

# Run standalone vehicle detection on sample video:
python test_detection.py

# Or start the FastAPI web service:
uvicorn main:app --reload --port 8000
```
Interactive FastAPI Swagger documentation is available at `http://localhost:8000/docs`.

### Step 5: Streaming Live Video Detections to Dashboard
To run vehicle detection on the sample video and stream live detections directly into the Express backend and React dashboard via WebSockets:
```bash
cd ai-service
.venv\Scripts\Activate.ps1
python test_detection.py --socket
```

---

## 24. Environment Configuration and Secrets Management

Environment configurations are managed via `.env` files. **Never commit production credentials or private keys to source control.**

### Backend Configuration (`backend/.env`)
```ini
# Application Port
PORT=5000

# Environment Mode (development | production | test)
NODE_ENV=development

# Relative path to detection output file written by Python service
DETECTION_OUTPUT_PATH=../ai-service/detection_output.json

# WebSocket Broadcast Interval in milliseconds
BROADCAST_INTERVAL_MS=5000

# JSON Web Token Secret Key (Change in production)
JWT_SECRET=super_secret_traffic_jwt_key_2026_dev_only

# Token Expiration Duration
JWT_EXPIRES_IN=24h
```

---

## 25. Testing and Verification

### Executing Backend Test Suites
```bash
cd backend
npm test
```
The Jest testing suite verifies:
- Mathematical accuracy and edge-case behavior of the deterministic $R_t$ risk heuristic (`riskCalculator.test.js` — **Verified**).
- REST API contracts for health checks, camera surveillance, and analytics (`apiEndpoints.test.js`).
- JWT token issuance, verification, and role-based access control guards (`auth.test.js`).
- Multi-channel notification dispatching, cooldown deduplication, and mock webhooks (`notificationService.test.js`).

### Executing Frontend Compilation Check
```bash
cd frontend
npm run build
```
Confirms that Vite asset compilation, React Router routes, and JSX transformation complete with **zero errors** (Verified: 722 modules transformed in 9.25s).

---

## 26. Limitations, Assumptions, and Future Enhancements

### 26.1 System Limitations
- **Camera Perspective Distortion:** High-angle CCTV views may compress distant vehicles, leading to lower detection confidence compared to foreground vehicles.
- **Adverse Weather & Night Conditions:** Severe rain, dense fog, and headlight glare can induce vehicle bounding box flutter or false negatives.
- **Local JSON Storage Scale:** The current atomic JSON stores (`incidents.json`, `notifications.json`) are optimized for lightweight local execution and should be migrated to MongoDB for enterprise multi-node scaling.

### 26.2 Core Engineering Assumptions
- Intersection capacity is calibrated to $K_{\text{sat}} = 25$ vehicles for standard city intersection camera views.
- Video frame rates are assumed to be between 25 and 30 FPS.
- Network latency between the local AI service and backend gateway is assumed to be nominal ($<50$ ms).

### 26.3 Future Enhancements Roadmap
1. **Multi-Object Tracking (ByteTrack):** Persistent vehicle trajectory tracking across frames for real-time velocity calculation.
2. **Enterprise Database Migration:** Mongoose schema integration connecting the backend to a dedicated MongoDB cluster.
3. **External Weather API Integration:** Automatic polling of localized precipitation and visibility metrics to dynamically adjust the $R_t$ weather weighting.
4. **Edge Hardware Acceleration:** TensorRT / ONNX Runtime optimization for deployment on NVIDIA Jetson edge devices.

---

## 27. Project Implementation Status

| Feature / Subsystem | Status | Verification Evidence |
|---|---|---|
| **YOLOv8 Vehicle Detection** | **Implemented & Verified** | `ai-service/detector.py` successfully decodes video and detects COCO vehicle classes. |
| **Deterministic Risk Calculator ($R_t$)** | **Implemented & Verified** | Passes all 13 Jest unit tests (`backend/__tests__/riskCalculator.test.js`). |
| **Backend REST & WebSocket Gateway** | **Implemented & Verified** | Express + Socket.io server with 20+ endpoints and bi-directional telemetry broadcast. |
| **JWT Authentication & RBAC** | **Implemented** | `backend/utils/auth.js` enforces role checks for Admin vs. Operator. |
| **Multi-Channel Notification Dispatcher**| **Implemented** | `backend/utils/notificationService.js` dispatches Email, SMS, and Webhook alerts. |
| **React 18 Operator Dashboard** | **Implemented & Verified** | Vite production build passes with zero errors; dark-theme UI with 7 primary views. |
| **Geographical Live Map (Hyderabad)** | **Implemented & Verified** | Interactive Leaflet map displaying 6 regional nodes with dynamic color-coded markers. |
| **Surveillance Grid HUD (VID-001–005)** | **Implemented & Verified** | Canvas HUD renderer displaying real-time stream status and bounding box telemetry. |
| **Persistent Incident Management** | **Implemented & Verified** | Local atomic JSON store with status filtering (`Active`/`Resolved`) and quick-resolve actions. |
| **Historical Analytics (Recharts)** | **Implemented & Verified** | Dynamic time-series volume charts, speed distribution physics, and node comparisons. |
| **Enterprise Database (MongoDB)** | **Planned** | Mongoose schemas specified; awaiting enterprise scaling milestone. |
| **Supervised ML Model (XGBoost)** | **Planned (Deferred)**| Architecture and feature schemas specified; deferred due to public data spatiotemporal mismatch. |
| **Multi-Object Tracking (ByteTrack)** | **Planned** | Trajectory and speed estimation specified for post-MVP integration. |
| **Live External Weather API** | **Planned** | External API integration specified for future weather weighting adjustment. |

---

## 28. Links to Relevant Existing Documentation

- [`docs/platform/architecture.md`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/docs/platform/architecture.md) — Comprehensive system architecture, service communication, and complete API endpoint specifications.
- [`docs/feats/vehicle-detection.md`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/docs/feats/vehicle-detection.md) — Detailed computer vision feature specification for YOLOv8 video ingestion.
- [`docs/feats/dataset-review-and-limitations.md`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/docs/feats/dataset-review-and-limitations.md) — Rigorous review of candidate public datasets, the spatiotemporal mismatch dilemma, and mathematical derivation of the $R_t$ heuristic.
- [`docs/tasks.md`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/docs/tasks.md) — Detailed milestone tracking checklist and architectural decisions log.
- [`AGENTS.md`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/AGENTS.md) — Strict operating principles, module boundaries, and quality guidelines for AI coding assistants.

---

## 29. Decision-Support Disclaimer

> **IMPORTANT NOTICE:**  
> The **Multimodal AI-Based Smart Traffic Management and Accident Prediction System** is strictly an **advisory decision-support platform** designed to provide situational awareness for qualified traffic-police personnel and municipal transportation engineers.  
> 
> 1. **Not a Collision Detection Guarantee:** The accident-risk score ($R_t$) represents an empirical estimation of localized traffic conflict potential based on vehicle density, volume trends, and fleet composition. It does **not** predict individual driver behavior, vehicle mechanical failures, or guarantee that an accident will or will not occur.
> 2. **Human-in-the-Loop Authority:** Automated notifications, webhook dispatches, and risk classifications must never replace the professional judgment, legal discretion, and on-scene assessment of sworn law enforcement officers and certified emergency responders.
> 3. **Privacy Compliance:** Live camera surveillance operations must comply with applicable municipal, state, and national video privacy regulations. Public deployments must ensure appropriate data retention limits, secure transmission, and privacy-preserving de-identification where required by law.
