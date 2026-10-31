# ai-service/schemas.py
#
# Pydantic data models — define the exact shape of every JSON object
# this service sends and receives.

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ─── Bounding box ────────────────────────────────────────────────────────
class BoundingBox(BaseModel):
    """
    The rectangle that surrounds a detected vehicle in the frame.
    All values are pixel coordinates (top-left origin).
    """
    x1: int = Field(description="Left edge, in pixels")
    y1: int = Field(description="Top edge, in pixels")
    x2: int = Field(description="Right edge, in pixels")
    y2: int = Field(description="Bottom edge, in pixels")


# ─── Centroid ─────────────────────────────────────────────────────────────
class Point(BaseModel):
    x: int = Field(description="X coordinate")
    y: int = Field(description="Y coordinate")


# ─── One detected vehicle ─────────────────────────────────────────────────
class VehicleDetection(BaseModel):
    """A single vehicle that YOLO found and multi-object tracker associated."""
    vehicle_class:    str           = Field(description="Type: car | truck | bus | motorcycle")
    confidence:       float         = Field(ge=0.0, le=1.0, description="YOLO confidence 0.0–1.0")
    bbox:             BoundingBox
    track_id:         Optional[int] = Field(default=None, description="Persistent tracking ID")
    direction:        Optional[str] = Field(default=None, description="inbound | outbound | stationary")
    centroid:         Optional[Point] = None
    crossed_tripwire: Optional[bool] = Field(default=False, description="Whether vehicle crossed the counting line")


# ─── All detections for one frame ─────────────────────────────────────────
class FrameResult(BaseModel):
    """Every vehicle detected in a single video frame with traffic density metrics."""
    frame_index:             int                    = Field(description="Frame number (0-based) in the video")
    timestamp_sec:           float                  = Field(description="Position in the video, in seconds")
    vehicle_count:           int                    = Field(description="Instantaneous vehicles found in frame (V_t)")
    vehicles:                List[VehicleDetection]
    active_tracks_count:     Optional[int]          = Field(default=0, description="Active persistent tracks")
    unique_vehicles_so_far:  Optional[int]          = Field(default=0, description="Distinct vehicles tracked up to this frame")
    total_line_crossings:    Optional[int]          = Field(default=0, description="Cumulative tripwire crossings")
    density_pct:             Optional[float]        = Field(default=0.0, description="Corridor saturation % (K_sat=25)")
    congestion_status:       Optional[str]          = Field(default="Free Flow", description="Free Flow | Moderate | Congested | Severe Bottleneck")
    level_of_service:        Optional[str]          = Field(default="A/B", description="Municipal Level of Service tier")


# ─── POST /detect  request body ───────────────────────────────────────────
class DetectRequest(BaseModel):
    """
    JSON body the caller sends to POST /detect.
    """
    video_path:     str   = Field(description="Absolute or relative path to the .mp4/.avi file")
    frame_interval: int   = Field(default=5,    ge=1,   description="Process every Nth frame")
    max_frames:     int   = Field(default=30,   ge=1, le=200, description="Max frames to process")
    confidence:     float = Field(default=0.40, ge=0.1, le=1.0, description="Min confidence threshold")


# ─── POST /detect  response ────────────────────────────────────────────────
class DetectResponse(BaseModel):
    """
    Full JSON result returned by POST /detect and GET /detect/sample.
    Contains a top-level summary, tracking analytics, and a per-frame breakdown.
    """
    source:                str               # video filename
    total_frames_in_video: int               # total frames in the file (not all processed)
    frames_processed:      int               # how many frames YOLO actually ran on
    frame_interval:        int               # every Nth frame was selected
    processing_time_sec:   float             # wall-clock seconds the detection took
    summary:               Dict[str, Any]    # totals and tracking analytics across all frames
    frames:                List[FrameResult] # per-frame breakdown


# ─── GET /health  response ─────────────────────────────────────────────────
class HealthResponse(BaseModel):
    """Service health status returned by GET /health."""
    status:       str
    model_loaded: bool
    model_name:   str
    service:      str
    note:         Optional[str] = None
    timestamp:    Optional[str] = None
    checks:       Optional[Dict[str, Any]] = None
