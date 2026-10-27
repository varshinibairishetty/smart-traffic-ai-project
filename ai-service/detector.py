# ai-service/detector.py
#
# Core detection logic — reads a video with OpenCV and runs YOLO on each frame.
#
# Plain-English walkthrough:
#   1. The YOLO model is loaded once and kept in memory (module-level variable).
#   2. run_detection() opens the video file — think of cv2.VideoCapture as
#      pressing Play on a video player.
#   3. We advance through the video frame by frame. Every Nth frame (controlled
#      by frame_interval) is sent to YOLO; the rest are skipped for speed.
#   4. YOLO returns a list of "boxes" — each box has a class ID, confidence
#      score, and pixel coordinates.
#   5. We throw away any box that is not a vehicle (COCO has 80 classes;
#      we only keep IDs 2, 3, 5, 7: car, motorcycle, bus, truck).
#   6. Results are packaged into the Pydantic schemas from schemas.py and
#      returned. main.py then serialises them to JSON.
#
# This file has NO knowledge of HTTP — that separation makes it easy to test
# the detection logic independently of the web server.

import logging
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Callable, Optional

import cv2
from ultralytics import YOLO

from config import (
    CONFIDENCE_THRESHOLD,
    FRAME_INTERVAL,
    MAX_FRAMES,
    MODEL_NAME,
    VEHICLE_CLASS_IDS,
    VEHICLE_CLASS_NAMES,
)
from risk_calculator import calculate_frame_risk
from schemas import BoundingBox, DetectResponse, FrameResult, VehicleDetection

logger = logging.getLogger(__name__)

# ── Module-level model cache ──────────────────────────────────────────────
# The model is stored here after the first load so every request reuses the
# same instance instead of reloading from disk (~1–2 s each time).
_model: Optional[YOLO] = None


def get_model() -> YOLO:
    """
    Return the cached YOLO model, loading it from disk on the first call.
    Subsequent calls return the already-loaded model instantly.
    """
    global _model
    if _model is None:
        logger.info("Loading YOLO model: %s (first-time download if not cached)", MODEL_NAME)
        _model = YOLO(MODEL_NAME)
        logger.info("YOLO model loaded successfully.")
    return _model


def is_model_loaded() -> bool:
    """Return True if the YOLO model is already in memory."""
    return _model is not None


# ── Main detection function ────────────────────────────────────────────────
def run_detection(
    video_path:     str,
    frame_interval: int   = FRAME_INTERVAL,
    max_frames:     int   = MAX_FRAMES,
    confidence:     float = CONFIDENCE_THRESHOLD,
    on_frame:       Optional[Callable[[dict, dict], None]] = None,
    socket_client:  Optional[Any] = None,
    stream_delay:   float = 0.0,
) -> DetectResponse:
    """
    Open a video file, run YOLO on sampled frames, and return structured results.
    Optionally computes rule-based risk (Rt) per frame and emits 'push_detection_frame'
    via a Socket.io client instance.

    Args:
        video_path:     Path to the .mp4 (or any OpenCV-supported) video file.
        frame_interval: Process 1 frame every N frames (default 5).
        max_frames:     Stop after processing this many frames (default 30).
        confidence:     Only keep detections above this threshold (default 0.40).
        on_frame:       Optional callback function(frame_dict, risk_dict) for each frame.
        socket_client:  Optional connected socketio.Client instance to push live frames.
        stream_delay:   Optional sleep delay in seconds between frames for live demo pace.

    Returns:
        DetectResponse — Pydantic model with per-frame results + summary.

    Raises:
        FileNotFoundError: if the video file does not exist on disk.
        ValueError:        if OpenCV cannot open the file (wrong format, corrupted).
    """
    path = Path(video_path)
    if not path.exists():
        raise FileNotFoundError(
            f"Video file not found: {video_path}\n"
            f"Tip: use an absolute path (e.g. C:/Users/you/Videos/traffic.mp4)"
        )

    model = get_model()

    # cv2.VideoCapture opens the video file — like pressing Play.
    # We'll read one frame at a time using cap.read().
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise ValueError(
            f"OpenCV could not open the video: {video_path}\n"
            f"Check that the file is a valid .mp4 / .avi and not corrupted."
        )

    # Read video metadata from the file header
    fps                   = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames_in_video = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    logger.info(
        "Detection started | file='%s' fps=%.1f total_frames=%d interval=%d max=%d",
        path.name, fps, total_frames_in_video, frame_interval, max_frames,
    )

    start_time       = time.perf_counter()
    frame_results: list[FrameResult]   = []
    frames_read      = 0  # total frames read from the file (including skipped ones)
    frames_processed = 0  # frames actually sent to YOLO

    # Accumulate vehicle class totals across all frames
    class_totals: dict[str, int] = defaultdict(int)

    # ── Main frame loop ────────────────────────────────────────────────────
    while frames_processed < max_frames:
        ret, bgr_frame = cap.read()   # read the next raw frame
        if not ret:
            break  # end of video (no more frames)

        frames_read += 1
        frame_index = frames_read - 1  # 0-based index in the video

        # Skip frames we don't want — only process every Nth frame.
        # (frames_read - 1) % frame_interval == 0 means frame 0, 5, 10, 15 …
        if frame_index % frame_interval != 0:
            continue

        timestamp_sec = round(frame_index / fps, 3)

        # ── Run YOLO inference ───────────────────────────────────────────
        # model() calls the neural network on the frame and returns results.
        # verbose=False silences per-frame console output from Ultralytics.
        yolo_results = model(bgr_frame, conf=confidence, verbose=False)

        # ── Parse raw YOLO output into our schema ───────────────────────
        detected_vehicles: list[VehicleDetection] = []

        for result in yolo_results:
            # result.boxes contains every detection in this frame.
            # Each box has: .cls (class ID), .conf (confidence), .xyxy (coords).
            for box in result.boxes:
                class_id = int(box.cls[0])

                # Filter: keep only vehicle classes we care about
                if class_id not in VEHICLE_CLASS_IDS:
                    continue

                conf_score = float(box.conf[0])
                class_name = VEHICLE_CLASS_NAMES[class_id]

                # box.xyxy[0] returns a tensor [x1, y1, x2, y2]
                x1, y1, x2, y2 = (int(v) for v in box.xyxy[0])

                detected_vehicles.append(
                    VehicleDetection(
                        vehicle_class=class_name,
                        confidence=round(conf_score, 4),
                        bbox=BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2),
                    )
                )
                class_totals[class_name] += 1

        frame_obj = FrameResult(
            frame_index=frame_index,
            timestamp_sec=timestamp_sec,
            vehicle_count=len(detected_vehicles),
            vehicles=detected_vehicles,
        )
        frame_results.append(frame_obj)
        frames_processed += 1

        # Calculate running rule-based risk score (Rt) for this processed frame
        running_avg = sum(r.vehicle_count for r in frame_results) / len(frame_results)
        frame_dict = frame_obj.model_dump()
        frame_risk = calculate_frame_risk(frame_dict, avg_vehicles=running_avg)

        # Notify callback if provided
        if on_frame is not None:
            try:
                on_frame(frame_dict, frame_risk)
            except Exception as exc:
                logger.warning("on_frame callback error: %s", exc)

        # Emit 'push_detection_frame' over Socket.io if client provided and connected
        if socket_client is not None:
            is_connected = getattr(socket_client, "connected", False)
            if is_connected:
                payload = {
                    "source": path.name,
                    "frame_index": frame_index,
                    "timestamp_sec": timestamp_sec,
                    "vehicle_count": len(detected_vehicles),
                    "vehicles": [v.model_dump() for v in detected_vehicles],
                    "risk": frame_risk,
                }
                try:
                    socket_client.emit("push_detection_frame", payload)
                    logger.debug("Emitted push_detection_frame for frame %d", frame_index)
                except Exception as exc:
                    logger.warning("Failed to emit push_detection_frame: %s", exc)

        logger.debug("  frame=%d ts=%.2fs vehicles=%d", frame_index, timestamp_sec, len(detected_vehicles))

        if stream_delay > 0:
            time.sleep(stream_delay)

    # Always release the file handle — prevents resource leaks
    cap.release()

    elapsed_sec = round(time.perf_counter() - start_time, 3)

    # ── Build overall summary ──────────────────────────────────────────────
    total_detections = sum(r.vehicle_count for r in frame_results)
    n_frames         = max(len(frame_results), 1)   # avoid division by zero

    summary = {
        "total_vehicle_detections": total_detections,
        "avg_vehicles_per_frame":   round(total_detections / n_frames, 2),
        "peak_vehicles_in_frame":   max((r.vehicle_count for r in frame_results), default=0),
        "by_class":                 dict(class_totals),
    }

    logger.info(
        "Detection done | frames_processed=%d total_detections=%d elapsed=%.2fs",
        frames_processed, total_detections, elapsed_sec,
    )

    return DetectResponse(
        source=path.name,
        total_frames_in_video=total_frames_in_video,
        frames_processed=frames_processed,
        frame_interval=frame_interval,
        processing_time_sec=elapsed_sec,
        summary=summary,
        frames=frame_results,
    )
