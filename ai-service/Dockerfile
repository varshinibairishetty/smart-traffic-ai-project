# ai-service/Dockerfile
# Container for FastAPI computer vision inference service (YOLOv8 + OpenCV)

FROM python:3.10-slim

WORKDIR /app

# Install system libraries required by OpenCV and ffmpeg video decoding
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY ai-service/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy AI service source code, sample videos, and YOLO model weights
COPY ai-service/ ./

# Expose FastAPI HTTP port
EXPOSE 8000

ENV HOST=0.0.0.0
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

# Healthcheck probe against FastAPI /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
