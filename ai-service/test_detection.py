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
#   # Option B — stream detections live over Socket.io to Express backend (port 5000):
#   python test_detection.py --socket
#
#   # Option C — specify any .mp4 on your machine:
#   python test_detection.py "C:/Users/varsh/Videos/traffic.mp4" --socket

import argparse
import json
import sys
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Smart Traffic AI — Detection Test & Live Socket Streamer")
    parser.add_argument("video_path", nargs="?", default=None, help="Optional path to MP4 video")
    parser.add_argument("--socket", "-s", action="store_true", help="Stream frames live via Socket.io to backend")
    parser.add_argument("--url", default="http://localhost:5000", help="Socket.io server URL (default: http://localhost:5000)")
    parser.add_argument("--delay", type=float, default=0.4, help="Delay in seconds between frames when streaming (default: 0.4s)")
    parser.add_argument("--frames", type=int, default=10, help="Max frames to process (default: 10)")
    parser.add_argument("--interval", type=int, default=5, help="Frame interval (default: 5)")

    args = parser.parse_args()

    # Use specified video path or default from config.py
    if args.video_path:
        video_path = args.video_path
    else:
        from config import DEFAULT_VIDEO_PATH
        video_path = str(DEFAULT_VIDEO_PATH)

    print("\n" + "=" * 58)
    print("  Smart Traffic AI — Detection Test")
    print("=" * 58)
    print(f"  Video   : {video_path}")
    print(f"  Socket  : {'Enabled (' + args.url + ')' if args.socket else 'Disabled (pass --socket to stream live)'}")
    print(f"  Note    : YOLO weights (~6 MB) download on first run.")
    print("=" * 58 + "\n")

    # Connect Socket.io client if requested
    sio = None
    if args.socket:
        try:
            import socketio
            sio = socketio.Client(reconnection=False)
            print(f"📡  Connecting to Socket.io backend at {args.url}...")
            sio.connect(args.url, transports=["websocket", "polling"])
            print("⚡  Connected to backend! Streaming live frames via 'push_detection_frame'...\n")
        except Exception as exc:
            print(f"⚠️  Could not connect to Socket.io server at {args.url}: {exc}")
            print("    Continuing standalone detection without live socket streaming.\n")
            sio = None

    # Import the detector (this also imports ultralytics — might take a moment)
    from detector import run_detection

    def on_frame_stream(frame_dict, risk_dict):
        score = risk_dict.get("score", 0)
        cat = risk_dict.get("category", "N/A")
        if sio and sio.connected:
            print(f"  ⚡ [Socket.io] Emitted Frame #{frame_dict.get('frame_index')} "
                  f"| Vehicles: {frame_dict.get('vehicle_count')} | Rt Risk: {score} ({cat})")

    try:
        result = run_detection(
            video_path=video_path,
            frame_interval=args.interval,
            max_frames=args.frames,
            confidence=0.40,
            socket_client=sio,
            on_frame=on_frame_stream if args.socket else None,
            stream_delay=args.delay if (args.socket and sio and sio.connected) else 0.0,
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

    if sio is not None and sio.connected:
        time.sleep(0.5)
        sio.disconnect()


if __name__ == "__main__":
    main()
