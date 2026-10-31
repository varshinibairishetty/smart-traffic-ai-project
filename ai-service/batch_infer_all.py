# ai-service/batch_infer_all.py
# Runs real YOLOv8 inference on all videos in videos/ and saves to ai-service/precomputed/

import json
from pathlib import Path
from run_inference_cli import process_video_yolo

project_root = Path(__file__).resolve().parent.parent
vdir = project_root / "videos"
out_dir = project_root / "ai-service" / "precomputed"
out_dir.mkdir(parents=True, exist_ok=True)

files = sorted(list(vdir.glob("*.mp4")))
print(f"Found {len(files)} video files to analyze.")

for f in files:
    print(f"Running OpenCV frame decoding and YOLOv8 on: {f.name} ...")
    res = process_video_yolo(str(f), frame_interval=5, max_frames=15, conf=0.35)
    out_file = out_dir / f"{f.name}.json"
    with open(out_file, "w", encoding="utf-8") as out_f:
        json.dump(res, out_f, indent=2)
    print(f"Successfully processed {f.name} -> Peak veh: {res.get('peak_vehicles_in_frame')}, By Class: {res.get('by_class')}")

print("Batch inference complete!")
