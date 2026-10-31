# Feature Specification: Vehicle Detection Subsystem

> **Status:** Implemented in `ai-service/`. Uses Ultralytics YOLOv8 and OpenCV to detect and classify vehicles in video frames.

---

## 1. Subsystem Scope

The vehicle detection subsystem processes input video frames to extract structured geometric and categorical data:
- **Vehicle Presence:** Identification of vehicles in individual frames.
- **Localization:** Bounding box pixel coordinates `[x1, y1, x2, y2]`.
- **Classification:** Mapping detected entities into one of four target vehicle classes: `car`, `truck`, `bus`, `motorcycle`.
- **Count & Density:** Aggregating vehicle counts per frame to compute traffic volume.

---

## 2. Technical Stack

| Component | Technology | Rationale |
|---|---|---|
| Detection Model | **YOLOv8n** (Ultralytics) | Lightweight nano model (~6 MB weights); balanced accuracy and inference speed on CPU. |
| Frame Ingestion | **OpenCV** (`cv2.VideoCapture`) | Standard video decoding and frame manipulation library. |
| Web Service | **FastAPI** + **Uvicorn** | High-performance asynchronous REST wrapper exposing detection endpoints. |
| Data Validation | **Pydantic** | Schema validation for structured JSON inputs and outputs. |

---

## 3. Data Interfaces

### 3.1 HTTP POST `/detect` Request Schema

```json
{
  "video_path": "sample_video/traffic-sample.mp4",
  "frame_interval": 5,
  "max_frames": 30,
  "confidence": 0.40
}
```

### 3.2 Detection Output Schema

Implemented in [`ai-service/schemas.py`](../../ai-service/schemas.py) and exported to `ai-service/detection_output.json`:

```json
{
  "source": "traffic-sample.mp4",
  "total_frames_in_video": 202,
  "frames_processed": 10,
  "frame_interval": 5,
  "processing_time_sec": 13.78,
  "summary": {
    "total_vehicle_detections": 150,
    "avg_vehicles_per_frame": 15.0,
    "peak_vehicles_in_frame": 22,
    "by_class": {
      "car": 141,
      "truck": 8,
      "bus": 1
    }
  },
  "frames": [
    {
      "frame_index": 0,
      "timestamp_sec": 0.0,
      "vehicle_count": 16,
      "vehicles": [
        {
          "vehicle_class": "car",
          "confidence": 0.7994,
          "bbox": {
            "x1": 339,
            "y1": 160,
            "x2": 406,
            "y2": 221
          }
        }
      ]
    }
  ]
}
```

---

## 4. Processing Pipeline

```
Local .mp4 / .avi Video File
        │
        ▼ (OpenCV: cv2.VideoCapture)
  Raw Frame (NumPy BGR array)
        │
        ▼ (YOLOv8n Inference)
  Raw Detections (bounding boxes, class IDs, confidence scores)
        │
        ▼ (Class Filter: COCO IDs {2, 3, 5, 7} & Confidence >= 0.40)
  Filtered Vehicle Detections
        │
        ▼ (Multi-Object Tracker: IoU Association & Centroid Trajectory)
  Persistent Track IDs & Trajectories (track_id, direction)
        │
        ▼ (Virtual Tripwire Line Crossing: y = 0.55 * height)
  Throughput Flow Count (Q) & Distinct Vehicles (N_unique)
        │
        ▼ (Stage 4 Corridor Density Analysis: K_sat = 25 veh)
  Density % (D_t), Flow Classification & Level of Service (LOS)
        │
        ▼ (Pydantic Serialization)
  Structured JSON Output  ──▶  detection_output.json / Socket.io / Backend API
```

---

## 5. File Structure (`ai-service/`)

```
ai-service/
├── main.py             ← FastAPI web application with endpoints (including /detect/upload)
├── detector.py         ← Core detection pipeline (OpenCV + YOLO + Tracker)
├── tracker.py          ← Multi-Object Vehicle Tracker (IoU + Centroid + Tripwire)
├── traffic_density.py  ← Stage 4 Corridor Density & Flow Classification Engine
├── config.py           ← Configurable thresholds and default paths
├── schemas.py          ← Pydantic validation models (with tracking & density fields)
├── risk_calculator.py  ← Python reference implementation of risk formula
├── test_detection.py   ← Standalone detection execution script
├── yolov8n.pt          ← Model weights file (cached locally)
├── sample_video/       ← Test video directory
└── requirements.txt    ← Python dependencies
```

---

## 6. Performance Characteristics (CPU Reference)

| Configuration | Model Variant | Typical Frame Processing Time (CPU) |
|---|---|---|
| Sample resolution (e.g. 720p / 1080p downsampled to 640px) | YOLOv8n (nano) | ~1.0 – 1.4 seconds per sampled frame |

Processing 1 frame every 5 frames (`frame_interval=5`) provides a high-fidelity sampling of traffic volume while maintaining acceptable CPU utilization.

---

## 7. Explicit Feature Boundaries

- **Implemented:**
  - Frame-level vehicle detection, bounding box localization, and 4-class vehicle categorization (`car`, `truck`, `bus`, `motorcycle`).
  - Multi-Object Tracking (MOT) associating vehicles across consecutive frames with persistent integer tracking IDs (`track_id`).
  - Trajectory estimation and vehicle direction detection (`inbound` vs. `outbound`).
  - Virtual tripwire line crossing counting ($Q$) preventing duplicate counts.
  - Corridor saturation density analysis ($D_t$) against municipal capacity ($K_{\text{sat}} = 25$ veh) and Level of Service (LOS A–F) grading.
  - Live video file upload validation (`.mp4`, `.avi`, `.mov`) via `POST /detect/upload`.
- **Not Included:**
  - License plate recognition (ALPR / ANPR) to protect municipal driver privacy.
  - Neural re-ID heavy embedding models (SORT baseline is used for zero-cost CPU execution).
  - Direct crash detection (addressed by the deterministic $R_t$ risk indicator).
