# ai-service/config.py
#
# Central configuration for the AI service.
# All tuneable settings live here so you never have to dig through
# detection or API code to change a threshold or file path.
#
# HOW TO USE:
#   Every other file imports from this module:
#     from config import CONFIDENCE_THRESHOLD, VEHICLE_CLASS_IDS

from pathlib import Path

# ── Model ────────────────────────────────────────────────────────────────
# "yolov8n" = YOLO version 8, Nano (smallest/fastest).
# The .pt file (~6 MB) downloads automatically on first run if not present.
# Other options: "yolov8s.pt" (small), "yolov8m.pt" (medium) — slower but more accurate.
MODEL_NAME = "yolov8n.pt"

# Minimum confidence score (0.0–1.0) to accept a detection.
# 0.40 = "I'm at least 40% sure this is a vehicle."
# Lower → more detections but more false positives.
# Higher → fewer detections but higher precision.
CONFIDENCE_THRESHOLD = 0.40

# ── COCO vehicle class IDs ───────────────────────────────────────────────
# YOLOv8n is trained on the COCO dataset which has 80 object categories.
# We only want detections that belong to vehicle categories.
# COCO IDs:  2=car  3=motorcycle  5=bus  7=truck
VEHICLE_CLASS_IDS = {2, 3, 5, 7}

# Human-readable label for each COCO class ID we care about
VEHICLE_CLASS_NAMES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

# ── Video processing ──────────────────────────────────────────────────────
# Process 1 frame out of every FRAME_INTERVAL frames.
# Example: FRAME_INTERVAL=5 on a 30 fps video → ~6 detections per second of video.
# Set to 1 to process every single frame (slower, more data).
FRAME_INTERVAL = 5

# Hard cap on how many frames to process per request.
# Prevents very long videos from running forever.
MAX_FRAMES = 30

# ── Default video path ────────────────────────────────────────────────────
# Used by GET /detect/sample. Place a short .mp4 here before testing.
# Path is relative to this file's location (i.e. inside ai-service/).
DEFAULT_VIDEO_PATH = Path(__file__).parent / "sample_video" / "traffic-sample.mp4"
