# ai-service/detector.py
#
# Core detection and tracking logic — reads a video with OpenCV, runs YOLOv8 on
# sampled frames, executes multi-object tracking (IoU + Centroid), and computes
# deterministic corridor density and tripwire line-crossing flow.

import json
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
from schemas import BoundingBox, DetectResponse, FrameResult, Point, VehicleDetection
from tracker import VehicleTracker
from traffic_density import analyze_traffic_density

logger = logging.getLogger(__name__)

# ── Module-level model cache ──────────────────────────────────────────────
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


# ── Main detection and tracking function ───────────────────────────────────
def run_detection(
    video_path:     str,
    frame_interval: int   = FRAME_INTERVAL,
    max_frames:     int   = MAX_FRAMES,
    confidence:     float = CONFIDENCE_THRESHOLD,
    on_frame:       Optional[Callable[[dict, dict], None]] = None,
    socket_client:  Optional[Any] = None,
    stream_delay:   float = 0.0,
    save_output:    bool  = True,
) -> DetectResponse:
    """
    Open a video file, run YOLO on sampled frames, track vehicles with persistent IDs,
    evaluate tripwire line crossing, compute traffic density, and return structured results.

    Args:
        video_path:     Path to the .mp4 / .avi video file.
        frame_interval: Process 1 frame every N frames (default 5).
        max_frames:     Stop after processing this many frames (default 30).
        confidence:     Only keep detections above this threshold (default 0.40).
        on_frame:       Optional callback function(frame_dict, risk_dict) for each frame.
        socket_client:  Optional connected socketio.Client instance to push live frames.
        stream_delay:   Optional sleep delay in seconds between frames for live demo pace.
        save_output:    Whether to write results to detection_output.json.

    Returns:
        DetectResponse — Pydantic model with per-frame results + tracking summary.
    """
    path = Path(video_path)
    if not path.exists():
        raise FileNotFoundError(
            f"Video file not found: {video_path}\n"
            f"Tip: use an absolute path (e.g. C:/Users/you/Videos/traffic.mp4)"
        )

    model = get_model()

    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise ValueError(
            f"OpenCV could not open the video: {video_path}\n"
            f"Check that the file is a valid .mp4 / .avi and not corrupted."
        )

    fps                   = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames_in_video = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_width           = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
    frame_height          = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720

    logger.info(
        "Detection started | file='%s' fps=%.1f total_frames=%d res=%dx%d interval=%d max=%d",
        path.name, fps, total_frames_in_video, frame_width, frame_height, frame_interval, max_frames,
    )

    # Initialize Multi-Object Vehicle Tracker
    tracker = VehicleTracker(
        iou_threshold=0.25,
        max_missed_frames=4,
        tripwire_y_ratio=0.55
    )

    start_time       = time.perf_counter()
    frame_results: list[FrameResult]   = []
    frames_read      = 0
    frames_processed = 0

    class_totals: dict[str, int] = defaultdict(int)

    # ── Main frame loop ────────────────────────────────────────────────────
    while frames_processed < max_frames:
        ret, bgr_frame = cap.read()
        if not ret:
            break

        frames_read += 1
        frame_index = frames_read - 1

        if frame_index % frame_interval != 0:
            continue

        timestamp_sec = round(frame_index / fps, 3)

        # Run YOLO inference
        yolo_results = model(bgr_frame, conf=confidence, verbose=False)

        raw_detections: list[dict] = []
        for result in yolo_results:
            for box in result.boxes:
                class_id = int(box.cls[0])
                if class_id not in VEHICLE_CLASS_IDS:
                    continue

                conf_score = float(box.conf[0])
                class_name = VEHICLE_CLASS_NAMES[class_id]
                x1, y1, x2, y2 = (int(v) for v in box.xyxy[0])

                raw_detections.append({
                    "vehicle_class": class_name,
                    "confidence": round(conf_score, 4),
                    "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
                })
                class_totals[class_name] += 1

        # Stage 3: Multi-Object Tracking & Line Counting
        tracked_detections = tracker.update(raw_detections, frame_height=frame_height)

        # Stage 4: Traffic Density & Congestion Analysis
        density_info = analyze_traffic_density(
            current_vehicle_count=len(tracked_detections),
            unique_vehicles_tracked=tracker.total_unique_vehicles,
            line_crossings=tracker.total_line_crossings,
            duration_sec=max(timestamp_sec, 0.1),
        )

        # Convert to Pydantic objects
        pydantic_vehicles: list[VehicleDetection] = []
        for td in tracked_detections:
            pydantic_vehicles.append(
                VehicleDetection(
                    vehicle_class=td["vehicle_class"],
                    confidence=td["confidence"],
                    bbox=BoundingBox(**td["bbox"]),
                    track_id=td.get("track_id"),
                    direction=td.get("direction"),
                    centroid=Point(**td["centroid"]) if "centroid" in td else None,
                    crossed_tripwire=td.get("crossed_tripwire", False),
                )
            )

        frame_obj = FrameResult(
            frame_index=frame_index,
            timestamp_sec=timestamp_sec,
            vehicle_count=len(pydantic_vehicles),
            vehicles=pydantic_vehicles,
            active_tracks_count=len(tracker.tracks),
            unique_vehicles_so_far=tracker.total_unique_vehicles,
            total_line_crossings=tracker.total_line_crossings,
            density_pct=density_info["density_pct"],
            congestion_status=density_info["congestion_status"],
            level_of_service=density_info["level_of_service"],
        )
        frame_results.append(frame_obj)
        frames_processed += 1

        running_avg = sum(r.vehicle_count for r in frame_results) / len(frame_results)
        frame_dict = frame_obj.model_dump()
        frame_risk = calculate_frame_risk(frame_dict, avg_vehicles=running_avg)

        if on_frame is not None:
            try:
                on_frame(frame_dict, frame_risk)
            except Exception as exc:
                logger.warning("on_frame callback error: %s", exc)

        # Push frame over Socket.io
        if socket_client is not None:
            is_connected = getattr(socket_client, "connected", False)
            if is_connected:
                payload = {
                    "source": path.name,
                    "frame_index": frame_index,
                    "timestamp_sec": timestamp_sec,
                    "vehicle_count": len(pydantic_vehicles),
                    "active_tracks_count": len(tracker.tracks),
                    "unique_vehicles_tracked": tracker.total_unique_vehicles,
                    "total_line_crossings": tracker.total_line_crossings,
                    "density_pct": density_info["density_pct"],
                    "congestion_status": density_info["congestion_status"],
                    "level_of_service": density_info["level_of_service"],
                    "vehicles": [v.model_dump() for v in pydantic_vehicles],
                    "risk": frame_risk,
                }
                try:
                    socket_client.emit("push_detection_frame", payload)
                except Exception as exc:
                    logger.warning("Failed to emit push_detection_frame: %s", exc)

        logger.debug(
            "  frame=%d ts=%.2fs vehicles=%d unique=%d flow=%d density=%.1f%%",
            frame_index, timestamp_sec, len(pydantic_vehicles),
            tracker.total_unique_vehicles, tracker.total_line_crossings, density_info["density_pct"]
        )

        if stream_delay > 0:
            time.sleep(stream_delay)

    cap.release()
    elapsed_sec = round(time.perf_counter() - start_time, 3)

    # Overall summary metrics
    total_detections = sum(r.vehicle_count for r in frame_results)
    n_frames         = max(len(frame_results), 1)
    peak_count       = max((r.vehicle_count for r in frame_results), default=0)
    avg_count        = round(total_detections / n_frames, 2)
    latest_density   = frame_results[-1].density_pct if frame_results else 0.0
    latest_status    = frame_results[-1].congestion_status if frame_results else "Free Flow"
    latest_los       = frame_results[-1].level_of_service if frame_results else "A/B"

    summary = {
        "total_vehicle_detections": total_detections,
        "total_unique_vehicles_tracked": tracker.total_unique_vehicles,
        "total_line_crossings": tracker.total_line_crossings,
        "line_crossing_inbound": tracker.line_crossing_inbound,
        "line_crossing_outbound": tracker.line_crossing_outbound,
        "avg_vehicles_per_frame": avg_count,
        "peak_vehicles_in_frame": peak_count,
        "corridor_density_pct": latest_density,
        "congestion_status": latest_status,
        "level_of_service": latest_los,
        "by_class": dict(class_totals),
    }

    logger.info(
        "Detection done | frames_processed=%d total_detections=%d unique=%d line_crossings=%d elapsed=%.2fs",
        frames_processed, total_detections, tracker.total_unique_vehicles, tracker.total_line_crossings, elapsed_sec,
    )

    response = DetectResponse(
        source=path.name,
        total_frames_in_video=total_frames_in_video,
        frames_processed=frames_processed,
        frame_interval=frame_interval,
        processing_time_sec=elapsed_sec,
        summary=summary,
        frames=frame_results,
    )

    # Save to detection_output.json
    if save_output:
        output_file = Path(__file__).parent / "detection_output.json"
        try:
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(response.model_dump(), f, indent=2)
            logger.info("Saved detection and tracking output to '%s'", output_file)
        except Exception as exc:
            logger.warning("Could not save detection_output.json: %s", exc)

    return response


if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Live OpenCV + YOLOv8 Vehicle Detector")
    parser.add_argument("video_path", nargs="?", default=None, help="Path to video file (.mp4, .avi)")
    parser.add_argument("--interval", type=int, default=5, help="Frame sample interval (default: 5)")
    parser.add_argument("--max-frames", type=int, default=30, help="Max frames to process (default: 30)")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold (default: 0.25)")
    args = parser.parse_args()

    if not args.video_path:
        print(json.dumps({"error": "Video path argument required. Usage: python detector.py <video_path>"}))
        sys.exit(1)

    result = run_detection(
        video_path=args.video_path,
        frame_interval=args.interval,
        max_frames=args.max_frames,
        confidence=args.conf,
        save_output=True
    )
    print(json.dumps(result.model_dump(), indent=2))
