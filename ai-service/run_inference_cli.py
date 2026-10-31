# ai-service/run_inference_cli.py
#
# Standalone CLI script to run frame-by-frame YOLOv8 vehicle detection on a given video file.
# Reads frames via OpenCV (cv2.VideoCapture), applies YOLOv8 model inference on sampled frames,
# dynamically counts COCO vehicle classes (car, truck, motorcycle, bus), and prints JSON output.

import json
import os
import sys
from collections import defaultdict
from pathlib import Path

import cv2
from ultralytics import YOLO

# Approved COCO vehicle classes and IDs
VEHICLE_CLASS_IDS = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}


def process_video_yolo(video_path: str, frame_interval: int = 5, max_frames: int = 20, conf: float = 0.25):
    path = Path(video_path)
    if not path.is_absolute():
        # Look in videos/ folder first or project root
        project_root = Path(__file__).resolve().parent.parent
        possible = [
            project_root / "videos" / path.name,
            project_root / video_path,
            Path(video_path),
        ]
        for p in possible:
            if p.exists():
                path = p
                break

    if not path.exists():
        return {
            "error": f"Video file not found: {video_path}",
            "vehicle_count": 0,
            "by_class": {"car": 0, "motorcycle": 0, "bus": 0, "truck": 0},
            "frames": []
        }

    model_path = Path(__file__).parent / "yolov8n.pt"
    if not model_path.exists():
        model_path = "yolov8n.pt"

    model = YOLO(str(model_path))

    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return {
            "error": f"OpenCV could not open video: {video_path}",
            "vehicle_count": 0,
            "by_class": {"car": 0, "motorcycle": 0, "bus": 0, "truck": 0},
            "frames": []
        }

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720

    frames_result = []
    processed_count = 0
    raw_frame_idx = 0
    class_totals = defaultdict(int)
    peak_vehicles = 0
    track_counter = 1

    while cap.isOpened() and processed_count < max_frames:
        ret, frame = cap.read()
        if not ret:
            break

        if raw_frame_idx % frame_interval == 0:
            timestamp_sec = round(raw_frame_idx / fps, 2)
            results = model.predict(frame, conf=conf, classes=list(VEHICLE_CLASS_IDS.keys()), verbose=False)
            boxes = results[0].boxes

            frame_vehicles = []
            frame_class_counts = defaultdict(int)

            if boxes is not None and len(boxes) > 0:
                for box in boxes:
                    cls_id = int(box.cls[0].item())
                    cls_name = VEHICLE_CLASS_IDS.get(cls_id)
                    if not cls_name:
                        continue

                    conf_val = round(float(box.conf[0].item()), 3)
                    xyxy = box.xyxy[0].tolist()
                    x1, y1, x2, y2 = [round(v, 1) for v in xyxy]

                    frame_class_counts[cls_name] += 1
                    class_totals[cls_name] += 1

                    # Direction estimate based on bbox centroid vs frame center
                    cx = (x1 + x2) / 2
                    cy = (y1 + y2) / 2
                    direction = "inbound" if cy < height * 0.55 else "outbound"
                    crossed_tripwire = abs(cy - (height * 0.55)) < (height * 0.08)

                    frame_vehicles.append({
                        "vehicle_class": cls_name,
                        "confidence": conf_val,
                        "bbox": {"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2)},
                        "track_id": track_counter,
                        "direction": direction,
                        "crossed_tripwire": crossed_tripwire
                    })
                    track_counter += 1

            count = len(frame_vehicles)
            if count > peak_vehicles:
                peak_vehicles = count

            frames_result.append({
                "frame_index": raw_frame_idx,
                "timestamp_sec": timestamp_sec,
                "vehicle_count": count,
                "by_class": {
                    "car": frame_class_counts["car"],
                    "motorcycle": frame_class_counts["motorcycle"],
                    "bus": frame_class_counts["bus"],
                    "truck": frame_class_counts["truck"],
                },
                "vehicles": frame_vehicles
            })

            processed_count += 1

        raw_frame_idx += 1

    cap.release()

    # Calculate average counts per frame across the sampled frames
    avg_per_frame = round(sum(f["vehicle_count"] for f in frames_result) / max(1, len(frames_result)), 1) if frames_result else 0

    # Determine ground-truth representative class breakdown
    # If a class was detected 0 times across all frames, its count is strictly 0!
    if frames_result:
        # Sum max per-class presence across frames or overall class presence scaled to peak
        # Strict zero-tolerance: if class_totals[cls] == 0, count is strictly 0!
        max_seen_per_class = {
            cls: max(f["by_class"].get(cls, 0) for f in frames_result)
            for cls in ["car", "motorcycle", "bus", "truck"]
        }
        
        # If total max seen exceeds peak, scale gracefully or use peak frame
        best_frame = max(frames_result, key=lambda f: f["vehicle_count"])
        final_by_class = {
            "car": max_seen_per_class["car"] if max_seen_per_class["car"] > 0 else 0,
            "motorcycle": max_seen_per_class["motorcycle"] if max_seen_per_class["motorcycle"] > 0 else 0,
            "bus": max_seen_per_class["bus"] if max_seen_per_class["bus"] > 0 else 0,
            "truck": max_seen_per_class["truck"] if max_seen_per_class["truck"] > 0 else 0,
        }
    else:
        final_by_class = {"car": 0, "motorcycle": 0, "bus": 0, "truck": 0}

    total_unique_count = sum(final_by_class.values()) or peak_vehicles

    return {
        "success": True,
        "video_path": str(path),
        "filename": path.name,
        "total_video_frames": total_video_frames,
        "frames_processed": len(frames_result),
        "fps": round(fps, 1),
        "resolution": f"{width}x{height}",
        "vehicle_count": total_unique_count,
        "peak_vehicles_in_frame": max(peak_vehicles, total_unique_count),
        "avg_vehicles_per_frame": avg_per_frame,
        "by_class": final_by_class,
        "total_detections_all_frames": sum(class_totals.values()),
        "frames": frames_result
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Video path argument required"}))
        sys.exit(1)

    vid = sys.argv[1]
    res = process_video_yolo(vid)
    print(json.dumps(res, indent=2))
