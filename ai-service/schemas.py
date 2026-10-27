# ai-service/schemas.py
#
# Pydantic data models — define the exact shape of every JSON object
# this service sends and receives.
#
# What is Pydantic?
#   It's a library that checks types automatically. If a field is declared
#   as `float` and you send a string, Pydantic either coerces it or returns
#   a clear error — so bad data never reaches the detection logic.
#
# These classes are used by:
#   - detector.py  (builds the objects)
#   - main.py      (declares them as response_model= on each route)

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ─── Bounding box ────────────────────────────────────────────────────────
class BoundingBox(BaseModel):
    """
    The rectangle that surrounds a detected vehicle in the frame.
    All values are pixel coordinates (top-left origin).

          (x1, y1) ────────────
              │                │
              │    vehicle     │
              │                │
              └──────── (x2, y2)
    """
    x1: int = Field(description="Left edge, in pixels")
    y1: int = Field(description="Top edge, in pixels")
    x2: int = Field(description="Right edge, in pixels")
    y2: int = Field(description="Bottom edge, in pixels")


# ─── One detected vehicle ─────────────────────────────────────────────────
class VehicleDetection(BaseModel):
    """A single vehicle that YOLO found in one frame."""
    vehicle_class: str   = Field(description="Type: car | truck | bus | motorcycle")
    confidence:    float = Field(ge=0.0, le=1.0, description="YOLO confidence 0.0–1.0")
    bbox:          BoundingBox


# ─── All detections for one frame ─────────────────────────────────────────
class FrameResult(BaseModel):
    """Every vehicle detected in a single video frame."""
    frame_index:   int   = Field(description="Frame number (0-based) in the video")
    timestamp_sec: float = Field(description="Position in the video, in seconds")
    vehicle_count: int   = Field(description="How many vehicles were found")
    vehicles:      List[VehicleDetection]


# ─── POST /detect  request body ───────────────────────────────────────────
class DetectRequest(BaseModel):
    """
    JSON body the caller sends to POST /detect.

    Example:
        {
          "video_path":     "C:/Users/you/videos/traffic.mp4",
          "frame_interval": 5,
          "max_frames":     20,
          "confidence":     0.4
        }
    """
    video_path:     str   = Field(description="Absolute or relative path to the .mp4 file")
    frame_interval: int   = Field(default=5,    ge=1,   description="Process every Nth frame")
    max_frames:     int   = Field(default=30,   ge=1, le=200, description="Max frames to process")
    confidence:     float = Field(default=0.40, ge=0.1, le=1.0, description="Min confidence threshold")


# ─── POST /detect  response ────────────────────────────────────────────────
class DetectResponse(BaseModel):
    """
    Full JSON result returned by POST /detect and GET /detect/sample.
    Contains a top-level summary and a per-frame breakdown.
    """
    source:                str               # video filename
    total_frames_in_video: int               # total frames in the file (not all processed)
    frames_processed:      int               # how many frames YOLO actually ran on
    frame_interval:        int               # every Nth frame was selected
    processing_time_sec:   float            # wall-clock seconds the detection took
    summary:               Dict[str, Any]   # totals across all frames
    frames:                List[FrameResult] # per-frame breakdown


# ─── GET /health  response ─────────────────────────────────────────────────
class HealthResponse(BaseModel):
    """Service health status returned by GET /health for container orchestration."""
    status:       str  # "ok" or "healthy" when ready
    model_loaded: bool # True once YOLOv8n is loaded into memory
    model_name:   str
    service:      str
    note:         Optional[str] = None
    timestamp:    Optional[str] = None
    checks:       Optional[Dict[str, Any]] = None
