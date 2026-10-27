# ai-service/socket_client.py
#
# Socket.io client script for the Smart Traffic AI service.
#
# Connects to the Express backend (default: http://localhost:5000) and emits
# 'push_detection_frame' events carrying frame-level vehicle counts,
# YOLO bounding boxes, and rule-based accident risk scores (Rt).
#
# USAGE:
#   # 1. Stream live YOLO detections from sample video:
#   python socket_client.py
#
#   # 2. Specify a custom video file and delay:
#   python socket_client.py --video sample_video/traffic-sample.mp4 --delay 0.5
#
#   # 3. Stream from existing detection_output.json (no GPU/YOLO re-run needed):
#   python socket_client.py --from-json
#
#   # 4. Continuous looping demo stream:
#   python socket_client.py --from-json --loop --delay 1.0

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

import socketio

from config import DEFAULT_VIDEO_PATH
from risk_calculator import calculate_frame_risk

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("TrafficSocketClient")


def create_socket_client(server_url: str = "http://localhost:5000") -> socketio.Client:
    """
    Initialize and connect a Socket.io client to the Smart Traffic backend.
    """
    sio = socketio.Client(
        reconnection=True,
        reconnection_attempts=5,
        reconnection_delay=1,
    )

    @sio.event
    def connect():
        logger.info("⚡ Connected to Smart Traffic backend at %s (socket id: %s)", server_url, sio.sid)

    @sio.event
    def disconnect():
        logger.warning("🔌 Disconnected from Smart Traffic backend")

    @sio.event
    def connect_error(data):
        logger.error("❌ Socket connection failed: %s", data)

    @sio.on("live_traffic_update")
    def on_live_traffic_update(data):
        logger.debug("Received broadcast echo: risk score=%s", data.get("risk", {}).get("score"))

    try:
        logger.info("Connecting to backend at %s ...", server_url)
        sio.connect(server_url, transports=["websocket", "polling"])
        return sio
    except Exception as exc:
        logger.error("Could not connect to %s: %s", server_url, exc)
        logger.error("Ensure the Express backend is running (`cd backend && npm start`).")
        raise


def emit_detection_frame(
    sio: socketio.Client,
    frame_payload: Dict[str, Any],
) -> bool:
    """
    Emit a 'push_detection_frame' event with the structured JSON payload.
    """
    if not sio.connected:
        logger.warning("Cannot emit frame: socket client is not connected")
        return False

    try:
        sio.emit("push_detection_frame", frame_payload)
        risk_info = frame_payload.get("risk", {})
        score = risk_info.get("score", "N/A")
        cat = risk_info.get("category", "N/A")
        logger.info(
            "📤 Pushed Frame #%-3s | Vehicles: %-2s | Rt Risk: %-3s (%-8s) | Time: %.2fs",
            frame_payload.get("frame_index", 0),
            frame_payload.get("vehicle_count", 0),
            score,
            cat,
            frame_payload.get("timestamp_sec", 0.0),
        )
        return True
    except Exception as exc:
        logger.error("Failed to emit detection frame: %s", exc)
        return False


def stream_from_video(
    video_path: str,
    server_url: str = "http://localhost:5000",
    frame_interval: int = 5,
    max_frames: int = 20,
    delay: float = 0.5,
    confidence: float = 0.40,
):
    """
    Run YOLO frame-by-frame on a video file and push each frame to Socket.io.
    """
    from detector import run_detection

    sio = create_socket_client(server_url)

    logger.info("Starting YOLO detection streaming for: %s", video_path)
    print("\n" + "=" * 65)
    print("  Smart Traffic AI — Real-time YOLO Socket Streamer")
    print(f"  Backend: {server_url} | Event: 'push_detection_frame'")
    print("=" * 65 + "\n")

    def on_frame_detected(frame_dict: dict, risk_dict: dict):
        payload = {
            "source": Path(video_path).name,
            "frame_index": frame_dict.get("frame_index", 0),
            "timestamp_sec": frame_dict.get("timestamp_sec", 0.0),
            "vehicle_count": frame_dict.get("vehicle_count", 0),
            "vehicles": frame_dict.get("vehicles", []),
            "risk": risk_dict,
        }
        emit_detection_frame(sio, payload)

    try:
        run_detection(
            video_path=video_path,
            frame_interval=frame_interval,
            max_frames=max_frames,
            confidence=confidence,
            on_frame=on_frame_detected,
            stream_delay=delay,
        )
        logger.info("Completed video stream processing.")
    finally:
        time.sleep(1.0)
        sio.disconnect()


def stream_from_json(
    json_path: str = "detection_output.json",
    server_url: str = "http://localhost:5000",
    delay: float = 0.8,
    loop: bool = False,
):
    """
    Stream pre-computed detection frames from detection_output.json.
    Useful for testing the dashboard real-time updates without GPU load.
    """
    p = Path(json_path)
    if not p.exists():
        logger.error("JSON detection file not found at: %s", p.resolve())
        return

    data = json.loads(p.read_text(encoding="utf-8"))
    frames = data.get("frames", [])
    source = data.get("source", "detection_output.json")
    summary = data.get("summary", {})
    avg_vehicles = summary.get("avg_vehicles_per_frame", 10.0)

    if not frames:
        logger.error("No frame data found in %s", json_path)
        return

    sio = create_socket_client(server_url)

    print("\n" + "=" * 65)
    print("  Smart Traffic AI — JSON Frame Socket Streamer")
    print(f"  Source: {source} | Total Frames: {len(frames)} | Loop: {loop}")
    print("=" * 65 + "\n")

    try:
        iteration = 1
        while True:
            logger.info("Beginning streaming run #%d (%d frames)...", iteration, len(frames))
            for f in frames:
                risk = calculate_frame_risk(f, avg_vehicles=avg_vehicles)
                payload = {
                    "source": source,
                    "frame_index": f.get("frame_index", 0),
                    "timestamp_sec": f.get("timestamp_sec", 0.0),
                    "vehicle_count": f.get("vehicle_count", 0),
                    "vehicles": f.get("vehicles", []),
                    "risk": risk,
                }
                emit_detection_frame(sio, payload)
                time.sleep(delay)

            if not loop:
                break
            iteration += 1
            time.sleep(1.0)

    except KeyboardInterrupt:
        logger.info("Streaming stopped by user.")
    finally:
        sio.disconnect()


def main():
    parser = argparse.ArgumentParser(description="Smart Traffic AI Socket.io Client")
    parser.add_argument(
        "--url",
        type=str,
        default="http://localhost:5000",
        help="Backend Socket.io server URL (default: http://localhost:5000)",
    )
    parser.add_argument(
        "--video",
        type=str,
        default=None,
        help="Path to MP4 traffic video to run YOLO and stream live",
    )
    parser.add_argument(
        "--from-json",
        action="store_true",
        help="Stream pre-computed detections from detection_output.json",
    )
    parser.add_argument(
        "--json-path",
        type=str,
        default="detection_output.json",
        help="Path to detection JSON file (default: detection_output.json)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="Delay in seconds between frame emissions (default: 0.5)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=5,
        help="Frame sample interval for video processing (default: 5)",
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=25,
        help="Maximum video frames to process (default: 25)",
    )
    parser.add_argument(
        "--loop",
        action="store_true",
        help="Loop JSON streaming continuously (useful for live demo)",
    )

    args = parser.parse_args()

    if args.from_json:
        stream_from_json(
            json_path=args.json_path,
            server_url=args.url,
            delay=args.delay,
            loop=args.loop,
        )
    else:
        video = args.video if args.video else str(DEFAULT_VIDEO_PATH)
        stream_from_video(
            video_path=video,
            server_url=args.url,
            frame_interval=args.interval,
            max_frames=args.max_frames,
            delay=args.delay,
        )


if __name__ == "__main__":
    main()
