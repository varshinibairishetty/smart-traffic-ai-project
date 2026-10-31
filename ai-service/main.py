# ai-service/main.py
#
# FastAPI application — defines HTTP routes and connects them to detector.py.
# Includes video file upload processing, validation, and tracking telemetry.

import logging
import os
import shutil
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from config import DEFAULT_VIDEO_PATH, MODEL_NAME
from detector import get_model, is_model_loaded, run_detection
from schemas import DetectRequest, DetectResponse, HealthResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Directory for uploaded videos
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv"}

# Local codebase videos directory and fallback
LOCAL_VIDEOS_DIR = Path(__file__).parent.parent / "videos"
FALLBACK_VIDEOS_DIR = Path(__file__).parent / "sample_video"


def get_active_videos_dir() -> Path:
    if LOCAL_VIDEOS_DIR.exists():
        return LOCAL_VIDEOS_DIR
    return FALLBACK_VIDEOS_DIR


def scan_local_videos():
    vdir = get_active_videos_dir()
    if not vdir.exists():
        vdir.mkdir(parents=True, exist_ok=True)
    return sorted([
        f.name for f in vdir.iterdir()
        if f.is_file() and f.suffix.lower() in ALLOWED_EXTENSIONS
    ])


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("Smart Traffic AI Service — starting up")
    vfiles = scan_local_videos()
    logger.info("Dynamically scanned videos/ folder: %d files detected: %s", len(vfiles), vfiles)
    logger.info("Loading YOLO model into memory …")
    get_model()
    logger.info("YOLO model ready.")
    logger.info("API docs available at: http://localhost:8000/docs")
    logger.info("=" * 60)

    yield

    logger.info("Server shutting down. Goodbye.")


app = FastAPI(
    title="Smart Traffic AI — Vehicle Detection & Tracking Service",
    description=(
        "**Real-time Traffic Video Analytics Pipeline.**  \n"
        "Reads local `.mp4`/`.avi` video feeds, runs YOLOv8 vehicle detection, "
        "executes multi-object tracking (IoU + Centroid), evaluates virtual tripwire flow, "
        "and computes corridor density metrics."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/", summary="Welcome / service info")
def root():
    return {
        "service": "Smart Traffic AI — Vehicle Detection & Tracking Service",
        "version": "1.0.0",
        "phase":   "End-to-End Traffic Video Analytics Pipeline",
        "docs":    "http://localhost:8000/docs",
        "routes": {
            "GET  /health":         "Service status and model state",
            "GET  /videos":         "Dynamically scan and list available local video feeds",
            "GET  /cameras":        "Dynamically mapped active cameras from local video files",
            "GET  /detect/sample":  "Run detection on default sample video",
            "POST /detect":         "Run detection on specified video path",
            "POST /detect/upload":  "Upload video file (.mp4, .avi) for automated analysis",
        },
    }


@app.get("/videos", summary="Dynamically scan and list available local traffic video feeds")
def list_videos():
    vdir = get_active_videos_dir()
    vfiles = scan_local_videos()
    cameras = []
    for idx, f in enumerate(vfiles):
        cam_num = idx + 1
        base = Path(f).stem
        clean = (
            base.replace("video", "")
            .replace("cam", "")
            .replace("_", " ")
            .replace("-", " ")
            .strip()
            .title()
        )
        cameras.append({
            "cam_id": f"CAM-{cam_num:02d}",
            "number": cam_num,
            "filename": f,
            "name": f"Camera {cam_num}: {clean or f'Feed {cam_num}'}",
            "location": f"{clean or f'Feed {cam_num}'} Corridor",
            "path": str(vdir / f)
        })
    return {
        "videos_directory": str(vdir),
        "total_videos": len(vfiles),
        "active_cameras_count": len(vfiles),
        "videos": vfiles,
        "cameras": cameras
    }


@app.get("/cameras", summary="Dynamically mapped active cameras from local video files")
def list_cameras():
    return list_videos()


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check for container and service readiness",
)
def health():
    output_path = os.path.join(os.path.dirname(__file__), "detection_output.json")
    sample_video_exists = os.path.exists(str(DEFAULT_VIDEO_PATH))
    detection_output_exists = os.path.exists(output_path)
    model_loaded = is_model_loaded()

    status = "ok" if model_loaded else "degraded"

    return HealthResponse(
        status=status,
        model_loaded=model_loaded,
        model_name=MODEL_NAME,
        service="Smart Traffic AI — Vehicle Detection & Tracking Service v1.0.0",
        note="Computer vision and multi-object tracking engine ready.",
        timestamp=str(os.times()),
        checks={
            "model": {
                "name": MODEL_NAME,
                "loaded": model_loaded,
                "target_classes": ["car", "truck", "bus", "motorcycle"]
            },
            "filesystem": {
                "sample_video_path": str(DEFAULT_VIDEO_PATH),
                "sample_video_accessible": sample_video_exists,
                "detection_output_accessible": detection_output_exists
            }
        }
    )


@app.get(
    "/detect/sample",
    response_model=DetectResponse,
    summary="Run detection on the default sample video",
)
def detect_sample():
    video_path = str(DEFAULT_VIDEO_PATH)
    logger.info("GET /detect/sample  →  '%s'", video_path)

    try:
        return run_detection(video_path)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"{exc} · Place a video at '{video_path}' or upload via POST /detect/upload"
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error in /detect/sample")
        raise HTTPException(status_code=500, detail=f"Detection failed: {exc}")


@app.post(
    "/detect",
    response_model=DetectResponse,
    summary="Run detection on a video file you specify",
)
def detect(request: DetectRequest):
    logger.info(
        "POST /detect  →  path='%s'  interval=%d  max=%d  conf=%.2f",
        request.video_path,
        request.frame_interval,
        request.max_frames,
        request.confidence,
    )

    try:
        return run_detection(
            video_path=request.video_path,
            frame_interval=request.frame_interval,
            max_frames=request.max_frames,
            confidence=request.confidence,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error in POST /detect")
        raise HTTPException(status_code=500, detail=f"Detection failed: {exc}")


@app.post(
    "/detect/upload",
    response_model=DetectResponse,
    summary="Upload a local video file for detection and tracking analysis",
)
async def detect_upload(file: UploadFile = File(...)):
    """
    Stage 1 Video Input Pipeline:
    Accepts video file upload (.mp4, .avi, .mov), validates file format,
    and runs the YOLOv8 + multi-object tracking pipeline.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No video file provided.")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported format '{ext}'. Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Save uploaded file safely
    dest_path = UPLOAD_DIR / f"upload_{file.filename}"
    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as exc:
        logger.exception("Failed to save uploaded video file")
        raise HTTPException(status_code=500, detail=f"Failed to save video: {exc}")

    logger.info("Uploaded video saved to '%s'. Starting pipeline...", dest_path)

    try:
        result = run_detection(str(dest_path), max_frames=40)
        return result
    except Exception as exc:
        logger.exception("Error processing uploaded video")
        raise HTTPException(status_code=500, detail=f"Video pipeline failed: {exc}")


@app.get("/videos", summary="List available local sample traffic video feeds")
def list_videos():
    """Returns catalog of local sample traffic video feeds."""
    sample_dir = Path(__file__).parent / "sample_video"
    videos = [
        {"id": "hitec-city", "name": "HITEC City Junction Feed", "file": "hitec-city.mp4", "location": "Cyber Towers / Hitec City"},
        {"id": "gachibowli", "name": "Gachibowli Corridor", "file": "gachibowli.mp4", "location": "Outer Ring Road (ORR)"},
        {"id": "madhapur", "name": "Madhapur Traffic Sample", "file": "madhapur.mp4", "location": "100 Feet Road / Ayyappa Society"},
        {"id": "jubilee-hills", "name": "Jubilee Hills Checkpost", "file": "jubilee-hills.mp4", "location": "Road No. 36 Intersection"},
    ]
    for v in videos:
        v["exists"] = (sample_dir / v["file"]).exists()
    return {"videos": videos}


@app.post(
    "/detect/select",
    response_model=DetectResponse,
    summary="Select and process a local traffic video feed",
)
def detect_select(request: DetectRequest):
    """
    Runs YOLOv8 vehicle detection and tracking on a selected local video feed.
    """
    sample_dir = Path(__file__).parent / "sample_video"
    target_path = Path(request.video_path)
    if not target_path.is_absolute() and not target_path.exists():
        target_path = sample_dir / target_path.name

    if not target_path.exists():
        target_path = sample_dir / "traffic-sample.mp4"

    return run_detection(
        video_path=str(target_path),
        frame_interval=request.frame_interval,
        max_frames=request.max_frames,
        confidence=request.confidence,
    )
