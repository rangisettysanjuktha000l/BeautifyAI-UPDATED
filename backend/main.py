"""
BeautifyAI — FastAPI Inference Server
Port : 8000
Handles: POST /beautify  — image + intensity → AI-enhanced image (fallback: original)
          GET  /health    — health check
"""

import os
import sys
import uuid
import shutil
import tempfile
import subprocess
import traceback
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

# ── Paths ─────────────────────────────────────────────────────────────
# This file lives at  backend/main.py
# inference.py lives at  backend/model/inference.py
BASE_DIR        = Path(__file__).resolve().parent          # .../backend/
MODEL_DIR       = BASE_DIR / "model"
CHECKPOINTS_DIR = MODEL_DIR / "checkpoints"
INFERENCE_SCRIPT = MODEL_DIR / "inference.py"
TEMP_DIR        = BASE_DIR / "temp_images"

TEMP_DIR.mkdir(exist_ok=True)

# ── App ───────────────────────────────────────────────────────────────
app = FastAPI(title="BeautifyAI Inference API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Beautify-Status", "X-Beautify-Message"],
)


# ── Model auto-detection ──────────────────────────────────────────────
def detect_checkpoint() -> Path | None:
    """
    Scan CHECKPOINTS_DIR for .pth files.
    Returns the most-recently-modified one, or None if the folder is empty.
    """
    if not CHECKPOINTS_DIR.exists():
        print(f"[BeautifyAI] ⚠️  Checkpoints directory not found: {CHECKPOINTS_DIR}")
        return None

    candidates = sorted(
        CHECKPOINTS_DIR.glob("*.pth"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,   # newest first
    )

    if not candidates:
        print(f"[BeautifyAI] ⚠️  No .pth files found in {CHECKPOINTS_DIR}")
        return None

    chosen = candidates[0]
    print(f"[BeautifyAI] ✅ Auto-detected checkpoint: {chosen.name}")
    return chosen


# ── Health check ──────────────────────────────────────────────────────
@app.get("/health")
async def health():
    checkpoint = detect_checkpoint()
    return {
        "status": "ok",
        "message": "BeautifyAI inference server is running ✅",
        "model_found": checkpoint is not None,
        "model_file": checkpoint.name if checkpoint else None,
        "inference_script": INFERENCE_SCRIPT.exists(),
    }


# ── Main endpoint ─────────────────────────────────────────────────────
@app.post("/beautify")
async def beautify(
    image: UploadFile = File(...),
    intensity: float  = Form(0.5),
):
    """
    Accepts:
        image     — image file (multipart/form-data)
        intensity — float in [0.0, 1.0]   (default 0.5)

    Returns:
        The AI-beautified image on success.
        The original uploaded image as a fallback on any failure.
        Header X-Beautify-Status: 'success' | 'fallback'
        Header X-Beautify-Message: human-readable status string
    """
    # ── Validate intensity ────────────────────────────────────────────
    intensity = max(0.0, min(1.0, float(intensity)))

    # ── Validate MIME type ───────────────────────────────────────────
    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
    content_type  = (image.content_type or "").lower()
    if content_type and content_type not in allowed_types:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image type: {content_type}. Use JPG, PNG, or WEBP.",
        )

    # ── Save uploaded image ───────────────────────────────────────────
    uid          = uuid.uuid4().hex
    suffix       = Path(image.filename or "upload.jpg").suffix or ".jpg"
    input_path   = TEMP_DIR / f"input_{uid}{suffix}"
    output_path  = TEMP_DIR / f"output_{uid}.jpg"

    try:
        with open(input_path, "wb") as f:
            shutil.copyfileobj(image.file, f)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded image: {exc}")

    # ── Detect model ──────────────────────────────────────────────────
    checkpoint = detect_checkpoint()
    if checkpoint is None:
        # No model → return original immediately
        print("[BeautifyAI] ⚠️  No model checkpoint found — returning original image.")
        return _fallback_response(
            input_path,
            "No model checkpoint found in model/checkpoints/. Returning original image.",
            cleanup=[output_path],
        )

    # ── Run inference via subprocess ──────────────────────────────────
    cmd = [
        sys.executable,           # same Python that runs this server
        str(INFERENCE_SCRIPT),
        "-i", str(input_path),
        "-o", str(output_path),
        "--intensity", str(intensity),
        "-w", str(checkpoint),
    ]

    print(f"[BeautifyAI] 🚀 Running: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,           # 5-minute hard timeout
            cwd=str(MODEL_DIR),    # run from model/ so relative imports work
        )

        if result.stdout:
            print(f"[BeautifyAI] inference stdout:\n{result.stdout}")
        if result.stderr:
            print(f"[BeautifyAI] inference stderr:\n{result.stderr}")

        # ── Check exit code ───────────────────────────────────────────
        if result.returncode != 0:
            raise RuntimeError(
                f"inference.py exited with code {result.returncode}.\n"
                f"stderr: {result.stderr[:500]}"
            )

        # ── Check output file actually exists ─────────────────────────
        if not output_path.exists() or output_path.stat().st_size == 0:
            raise RuntimeError("inference.py succeeded but output file is missing or empty.")

        # ── Success ───────────────────────────────────────────────────
        print(f"[BeautifyAI] ✅ Inference succeeded → {output_path.name}")
        return _success_response(input_path, output_path, intensity)

    except subprocess.TimeoutExpired:
        print("[BeautifyAI] ⏱️  Inference timed out after 300 s — returning original.")
        return _fallback_response(
            input_path,
            "Inference timed out. Returning original image.",
            cleanup=[output_path],
        )

    except Exception as exc:
        print(f"[BeautifyAI] ❌ Inference failed: {exc}")
        traceback.print_exc()
        return _fallback_response(
            input_path,
            f"Inference failed ({type(exc).__name__}). Returning original image.",
            cleanup=[output_path],
        )


# ── Helpers ───────────────────────────────────────────────────────────
def _success_response(input_path: Path, output_path: Path, intensity: float):
    """Return the AI-enhanced image and schedule temp file cleanup."""
    media_type = _guess_media_type(output_path)

    def cleanup():
        _safe_remove(input_path)
        _safe_remove(output_path)

    response = FileResponse(
        path=str(output_path),
        media_type=media_type,
        filename=f"beautified_{output_path.name}",
        background=None,
    )
    response.headers["X-Beautify-Status"]  = "success"
    response.headers["X-Beautify-Message"] = (
        f"AI beautification applied at intensity {intensity:.2f}"
    )

    # Schedule cleanup after the response is fully sent
    import asyncio
    from starlette.background import BackgroundTask
    response.background = BackgroundTask(cleanup)
    return response


def _fallback_response(input_path: Path, message: str, cleanup: list[Path] | None = None):
    """Return the original image with a fallback status header."""
    media_type = _guess_media_type(input_path)

    extra_files = cleanup or []

    def do_cleanup():
        _safe_remove(input_path)
        for p in extra_files:
            _safe_remove(p)

    from starlette.background import BackgroundTask

    response = FileResponse(
        path=str(input_path),
        media_type=media_type,
        filename=f"original_{input_path.name}",
        background=None,
    )
    response.headers["X-Beautify-Status"]  = "fallback"
    response.headers["X-Beautify-Message"] = message
    response.background = BackgroundTask(do_cleanup)
    return response


def _guess_media_type(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".jpg":  "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png":  "image/png",
        ".webp": "image/webp",
        ".gif":  "image/gif",
    }.get(ext, "image/jpeg")


def _safe_remove(path: Path):
    try:
        if path.exists():
            path.unlink()
    except Exception as e:
        print(f"[BeautifyAI] Warning: could not delete temp file {path}: {e}")


# ── Entry point ───────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("\n🌸 BeautifyAI Inference Server")
    print(f"   Checkpoints dir : {CHECKPOINTS_DIR}")
    print(f"   Inference script: {INFERENCE_SCRIPT}")
    checkpoint = detect_checkpoint()
    if checkpoint:
        print(f"   Model loaded    : {checkpoint.name}")
    else:
        print("   ⚠️  No model found — will return fallback images until one is added.")
    print("\n🚀 Starting on http://localhost:8000\n")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
