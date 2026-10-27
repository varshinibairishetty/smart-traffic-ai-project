# ai-service/test_detection.py
#
# Standalone test script — runs the detector directly WITHOUT starting the
# FastAPI server. Use this to verify YOLO works on your laptop before
# worrying about the HTTP layer.
#
# USAGE:
#   # Option A — use the default sample video path (config.py):
#   python test_detection.py
#
#   # Option B — specify any .mp4 on your machine:
#   python test_detection.py "C:/Users/varsh/Videos/traffic.mp4"
#
# Expected output:
#   - A progress log showing which frames are being processed
#   - A summary of how many vehicles were detected
#   - A file called detection_output.json with the full results

import json
import sys
from pathlib import Path


def main():
    # Use a command-line argument as the video path, or fall back to the default
    if len(sys.argv) > 1:
        video_path = sys.argv[1]
    else:
        # Import config here (not at module level) so we get a clear error
        # if someone runs this from the wrong directory
        from config import DEFAULT_VIDEO_PATH
        video_path = str(DEFAULT_VIDEO_PATH)

    print("\n" + "=" * 58)
    print("  Smart Traffic AI — Standalone Detection Test")
    print("=" * 58)
    print(f"  Video : {video_path}")
    print(f"  Note  : YOLO weights (~6 MB) download on first run.")
    print("=" * 58 + "\n")

    # Import the detector (this also imports ultralytics — might take a moment)
    from detector import run_detection

    try:
        result = run_detection(
            video_path=video_path,
            frame_interval=5,   # process every 5th frame
            max_frames=10,      # limit to 10 frames so the test is quick
            confidence=0.40,
        )

    except FileNotFoundError as exc:
        print(f"\n❌  File not found: {exc}")
        print(
            "\n  How to fix:\n"
            "  1. Place a short .mp4 video at:\n"
            f"     {video_path}\n"
            "  2. Or run:  python test_detection.py path/to/your/video.mp4\n"
        )
        sys.exit(1)

    except ValueError as exc:
        print(f"\n❌  Could not open video: {exc}")
        sys.exit(1)

    # ── Print summary to terminal ──────────────────────────────────────────
    print("✅  Detection complete!\n")
    print(f"  Source            : {result.source}")
    print(f"  Frames in video   : {result.total_frames_in_video}")
    print(f"  Frames processed  : {result.frames_processed}")
    print(f"  Processing time   : {result.processing_time_sec} s")
    print()
    print("  ── Summary ──────────────────────────────────────────")
    print(f"  Total detections  : {result.summary['total_vehicle_detections']}")
    print(f"  Avg per frame     : {result.summary['avg_vehicles_per_frame']}")
    print(f"  Peak in one frame : {result.summary['peak_vehicles_in_frame']}")
    print(f"  By class          : {result.summary['by_class']}")

    # ── Print per-frame detail ─────────────────────────────────────────────
    print()
    print("  ── Per-frame results ────────────────────────────────")
    for frame in result.frames:
        bar = "█" * frame.vehicle_count  # simple ASCII bar chart
        print(f"  Frame {frame.frame_index:>4}  @{frame.timestamp_sec:>6.2f}s"
              f"  [{frame.vehicle_count:>2} vehicles] {bar}")

    # ── Show detail for the first frame ───────────────────────────────────
    if result.frames and result.frames[0].vehicles:
        print()
        print("  ── First frame — individual detections ─────────────")
        for v in result.frames[0].vehicles:
            print(
                f"    {v.vehicle_class:<12}  conf={v.confidence:.2f}"
                f"  bbox=({v.bbox.x1},{v.bbox.y1}) → ({v.bbox.x2},{v.bbox.y2})"
            )

    # ── Write full JSON to file ────────────────────────────────────────────
    out_path = Path("detection_output.json")
    out_path.write_text(result.model_dump_json(indent=2), encoding="utf-8")

    print()
    print(f"  Full JSON written to: {out_path.resolve()}")
    print("=" * 58 + "\n")


if __name__ == "__main__":
    main()
