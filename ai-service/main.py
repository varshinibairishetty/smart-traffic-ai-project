# ai-service/main.py
#
# FastAPI application — defines HTTP routes and connects them to detector.py.
#
# Plain-English analogy:
#   FastAPI is like a waiter in a restaurant.
#   - A client (browser, curl, the backend) sends an HTTP request (places an order).
#   - FastAPI matches the URL + method to the right Python function (sends it to the kitchen).
#   - The function (detector.py) does the real work and returns data (the meal).
#   - FastAPI automatically serialises the Pydantic model to JSON and sends it back.
#
# Routes this file defines:
#   GET  /                →  Welcome message (confirms service is alive)
#   GET  /health          →  Service status + whether YOLO is loaded
#   GET  /detect/sample   →  Run detection on the default sample video (quick test)
#   POST /detect          →  Run detection on any video path you specify
#
# Run with:
#   uvicorn main:app --reload --port 8000
# Then open:
#   http://localhost:8000/docs   ← interactive API docs (try endpoints in browser)

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import DEFAULT_VIDEO_PATH, MODEL_NAME
from detector import get_model, is_model_loaded, run_detection
from schemas import DetectRequest, DetectResponse, HealthResponse

# ── Logging setup ─────────────────────────────────────────────────────────
# Log messages appear in the terminal so you can see exactly what is happening.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Lifespan: startup / shutdown logic ────────────────────────────────────
# This context manager runs code before the server accepts requests (startup)
# and after it stops (shutdown). Loading the model here — rather than on the
# first request — means the very first /detect call responds in milliseconds.
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ───────────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info("Smart Traffic AI Service — starting up")
    logger.info("Loading YOLO model into memory …")
    get_model()   # caches the model in detector.py's module-level variable
    logger.info("YOLO model ready.")
    logger.info("API docs available at: http://localhost:8000/docs")
    logger.info("=" * 60)

    yield   # ← server is live and handling requests here

    # ── SHUTDOWN ──────────────────────────────────────────────────────────
    logger.info("Server shutting down. Goodbye.")


# ── FastAPI application instance ──────────────────────────────────────────
app = FastAPI(
    title="Smart Traffic AI — Vehicle Detection Service",
    description=(
        "**Phase 2 AI service.**  \n"
        "Reads a local `.mp4` video with OpenCV, runs YOLOv8n vehicle detection, "
        "and returns per-frame JSON results.  \n\n"
        "**Not yet connected:** risk model · MongoDB · frontend."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

# ── CORS middleware ────────────────────────────────────────────────────────
# Allows the React frontend (port 5173) to call this service from the browser
# without triggering a Cross-Origin Resource Sharing (CORS) error.
# Only allow origins that we control — never use allow_origins=["*"] in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/", summary="Welcome / service info")
def root():
    """
    Returns a welcome message confirming the service is running.
    No detection happens here — use **/detect/sample** or **POST /detect**.
    """
    return {
        "service": "Smart Traffic AI — Vehicle Detection Service",
        "version": "0.2.0",
        "phase":   "Phase 2 — Vehicle detection only",
        "docs":    "http://localhost:8000/docs",
        "routes": {
            "GET  /health":         "Service status and model state",
            "GET  /detect/sample":  "Run detection on the default sample video",
            "POST /detect":         "Run detection on a video path you specify",
        },
    }


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
)
def health():
    """
    Returns whether the service is running and whether the YOLO model
    is loaded into memory. Call this first to confirm everything is ready
    before sending a detection request.
    """
    return HealthResponse(
        status="ok",
        model_loaded=is_model_loaded(),
        model_name=MODEL_NAME,
        service="Smart Traffic AI — Vehicle Detection Service v0.2.0",
        note="Phase 2 — no risk model, database, or frontend integration yet.",
    )


@app.get(
    "/detect/sample",
    response_model=DetectResponse,
    summary="Run detection on the default sample video",
)
def detect_sample():
    """
    Runs vehicle detection on the pre-configured sample video defined in
    `config.py → DEFAULT_VIDEO_PATH`.

    **Before calling this:**  
    Place a short `.mp4` file at:  
    `ai-service/sample_video/traffic-sample.mp4`

    No request body needed — great for quick testing.
    """
    video_path = str(DEFAULT_VIDEO_PATH)
    logger.info("GET /detect/sample  →  '%s'", video_path)

    try:
        return run_detection(video_path)

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=(
                f"{exc}  ·  "
                f"Place a video at 'ai-service/sample_video/traffic-sample.mp4' "
                f"or use POST /detect with a custom path."
            ),
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
    """
    Runs vehicle detection on the video file at the path you provide.

    **Example request body:**
    ```json
    {
      "video_path":     "C:/Users/varsh/Videos/traffic.mp4",
      "frame_interval": 5,
      "max_frames":     20,
      "confidence":     0.4
    }
    ```

    Returns a JSON object with:
    - An overall summary (total detections, average vehicles per frame, counts by class)
    - A per-frame breakdown (frame index, timestamp, vehicle list with bounding boxes)
    """
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
