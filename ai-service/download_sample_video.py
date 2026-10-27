# ai-service/download_sample_video.py
#
# One-shot helper script — downloads a free traffic video and converts it
# to MP4 using FFmpeg.
#
# USAGE (from inside ai-service/, with .venv active):
#   python download_sample_video.py
#
# What it does:
#   1. Tries a list of known public-domain video URLs in order.
#   2. Saves the first successful download as the raw file.
#   3. If FFmpeg is on your PATH, converts to traffic-sample.mp4.
#   4. Verifies OpenCV can open the result and prints frame info.
#   5. Cleans up the raw download if conversion succeeded.

import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

# ── Target paths ──────────────────────────────────────────────────────────
SAMPLE_DIR = Path(__file__).parent / "sample_video"
FINAL_MP4  = SAMPLE_DIR / "traffic-sample.mp4"

# ── Candidate download URLs (tried in order until one succeeds) ───────────
# All are public-domain or Creative Commons, no login required.
# Each entry: (url, raw_filename, description)
CANDIDATES = [
    (
        # Wikimedia Commons — NYC intersection traffic (WebM/VP9, ~15 MB, 60 s)
        # License: Creative Commons CC0
        "https://upload.wikimedia.org/wikipedia/commons/transcoded/"
        "9/90/NYC_Intersection_Traffic.ogv/"
        "NYC_Intersection_Traffic.ogv.480p.vp9.webm",
        "raw_traffic.webm",
        "Wikimedia — NYC Intersection Traffic (WebM)",
    ),
    (
        # Wikimedia Commons — lower-resolution fallback (OGV container)
        "https://upload.wikimedia.org/wikipedia/commons/"
        "9/90/NYC_Intersection_Traffic.ogv",
        "raw_traffic.ogv",
        "Wikimedia — NYC Intersection Traffic (OGV)",
    ),
    (
        # Google sample videos bucket — street driving footage (MP4, ~50 MB)
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/"
        "sample/SubaruOutbackOnStreetAndDirt.mp4",
        "raw_traffic.mp4",
        "Google sample bucket — Subaru street/dirt driving",
    ),
    (
        # Another Google sample — "Volvo" ad with road footage (MP4, ~26 MB)
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/"
        "sample/VolkswagenGTIReview.mp4",
        "raw_traffic.mp4",
        "Google sample bucket — Volkswagen GTI road review",
    ),
]


# ── Helpers ───────────────────────────────────────────────────────────────

def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def download_file(url: str, dest: Path, label: str) -> bool:
    """Download url → dest. Returns True on success."""
    print(f"\n  Trying: {label}")
    print(f"  URL   : {url[:80]}{'…' if len(url) > 80 else ''}")
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; SmartTrafficAI/0.2)"},
        )
        with urllib.request.urlopen(req, timeout=120) as resp, open(dest, "wb") as f:
            total = int(resp.headers.get("Content-Length", 0))
            downloaded = 0
            chunk = 1024 * 64  # 64 KB chunks
            while True:
                data = resp.read(chunk)
                if not data:
                    break
                f.write(data)
                downloaded += len(data)
                if total:
                    pct = downloaded * 100 // total
                    mb  = downloaded / 1_048_576
                    print(f"\r  {pct:3d}%  {mb:.1f} MB", end="", flush=True)
        size_mb = dest.stat().st_size / 1_048_576
        print(f"\r  ✅  Downloaded {size_mb:.1f} MB → {dest.name}")
        return True
    except Exception as exc:
        if dest.exists():
            dest.unlink()
        print(f"\r  ❌  Failed: {exc}")
        return False


def convert_to_mp4(src: Path, dst: Path) -> bool:
    """Convert src video to dst MP4 using FFmpeg. Returns True on success."""
    if not ffmpeg_available():
        return False
    print(f"\n  Converting {src.name} → {dst.name} with FFmpeg …")
    cmd = [
        "ffmpeg", "-y",          # -y = overwrite output without asking
        "-i", str(src),          # input file
        "-c:v", "libx264",       # H.264 video codec (compatible everywhere)
        "-crf", "23",            # quality (lower = better; 23 is default)
        "-preset", "fast",       # encoding speed vs. file size trade-off
        "-an",                   # no audio (traffic video, audio not needed)
        "-movflags", "+faststart", # optimise for streaming / quick open
        str(dst),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        size_mb = dst.stat().st_size / 1_048_576
        print(f"  ✅  Converted → {dst.name}  ({size_mb:.1f} MB)")
        return True
    else:
        print(f"  ❌  FFmpeg failed:\n{result.stderr[-500:]}")
        return False


def verify_with_opencv(path: Path) -> bool:
    """Try to open the video with OpenCV and read 5 frames. Returns True on success."""
    try:
        import cv2
    except ImportError:
        print("\n  ⚠️  opencv-python not installed — skipping frame check.")
        print("      Run:  pip install opencv-python")
        return False

    print(f"\n  Verifying {path.name} with OpenCV …")
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        print("  ❌  OpenCV could not open the file.")
        return False

    fps    = cap.get(cv2.CAP_PROP_FPS)
    total  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    dur    = total / fps if fps else 0

    frames_read = 0
    for _ in range(5):
        ret, _ = cap.read()
        if ret:
            frames_read += 1
    cap.release()

    if frames_read == 0:
        print("  ❌  OpenCV opened the file but could not read any frames.")
        return False

    print(f"  ✅  OpenCV check passed!")
    print(f"      Resolution : {width}×{height}")
    print(f"      FPS        : {fps:.2f}")
    print(f"      Frames     : {total}")
    print(f"      Duration   : {dur:.1f} seconds")
    return True


# ── Main ──────────────────────────────────────────────────────────────────

def main():
    print("\n" + "=" * 60)
    print("  Smart Traffic AI — Sample Video Downloader")
    print("=" * 60)

    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)

    if FINAL_MP4.exists():
        size_mb = FINAL_MP4.stat().st_size / 1_048_576
        print(f"\n  ℹ️  traffic-sample.mp4 already exists ({size_mb:.1f} MB).")
        print("  Skipping download. Running verification only.\n")
        verify_with_opencv(FINAL_MP4)
        print("\n" + "=" * 60)
        return

    print(f"\n  FFmpeg available: {'YES — will convert to MP4' if ffmpeg_available() else 'NO — will keep original format'}")

    # Try each candidate URL
    raw_path = None
    for url, raw_name, label in CANDIDATES:
        dest = SAMPLE_DIR / raw_name
        if download_file(url, dest, label):
            raw_path = dest
            break

    if raw_path is None:
        print("\n❌  All download sources failed.")
        print("\n  Manual steps:")
        print("  1. Download any short traffic .mp4 from https://mixkit.co/free-stock-video/traffic/")
        print(f"  2. Save it as:  {FINAL_MP4}")
        print("  3. Re-run:      python test_detection.py")
        sys.exit(1)

    # Convert to MP4 if the raw file is not already MP4
    if raw_path.suffix.lower() == ".mp4" and raw_path.name == FINAL_MP4.name:
        # Already the right file — just verify
        pass
    elif raw_path.suffix.lower() == ".mp4":
        raw_path.rename(FINAL_MP4)
    else:
        # Need FFmpeg conversion
        if ffmpeg_available():
            ok = convert_to_mp4(raw_path, FINAL_MP4)
            if ok:
                raw_path.unlink()   # delete the raw WebM/OGV to save space
            else:
                print(f"\n  FFmpeg conversion failed. Keeping raw file: {raw_path.name}")
                print(f"  Update config.py → DEFAULT_VIDEO_PATH to point to: {raw_path}")
        else:
            print(f"\n  FFmpeg not found. Keeping raw file as-is: {raw_path}")
            print(f"  To convert manually, install FFmpeg from https://www.gyan.dev/ffmpeg/builds/")
            print(f"  Then run:")
            print(f"    ffmpeg -i {raw_path} -c:v libx264 -an {FINAL_MP4}")

    # Verify
    target = FINAL_MP4 if FINAL_MP4.exists() else raw_path
    all_ok = verify_with_opencv(target)

    print("\n" + "=" * 60)
    if all_ok:
        print(f"\n  ✅  Ready! Run detection with:")
        print(f"      python test_detection.py")
    else:
        print(f"\n  ⚠️  File present but verification failed.")
        print(f"      The video may be corrupted. Try another source.")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
