"""
main.py — FastAPI Backend for Neural Style Transfer
=====================================================
Provides REST API endpoints consumed by the React frontend.

Endpoints:
  GET  /              → health check
  GET  /styles        → list all available style presets
  POST /stylize       → upload images, start style transfer job
  GET  /status/{id}   → poll job progress
  GET  /result/{id}   → download the output image
  GET  /docs          → auto-generated interactive API docs (FastAPI built-in!)

Architecture note:
  Style transfer is slow (2-5 min on CPU). We run it in a background
  thread via FastAPI's BackgroundTasks so the HTTP response returns
  immediately, and the client polls /status/{id} for progress.
"""

import uuid
import os
import shutil
import threading
from pathlib import Path
from typing import Optional
from datetime import datetime
from enum import Enum

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from nst_engine import (
    run_style_transfer,
    get_style_presets,
    get_preset_config,
    STYLE_PRESETS,
)

# ─────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────
app = FastAPI(
    title="Neural Style Transfer API",
    description="""
## 🎨 Neural Style Transfer API

Upload a **content image** (your photo) and a **style image** (an artwork),
and get back a stylized version of your photo painted in the artwork's style.

### How it works
1. POST to `/stylize` with your images
2. Get back a `job_id`
3. Poll `GET /status/{job_id}` until status is `completed`
4. Download result from `GET /result/{job_id}`

### Using presets
Instead of uploading a style image, pass a `preset` name to use one of our
curated artworks (Starry Night, The Scream, Kandinsky, etc.)
    """,
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────
# Allow the React frontend (running on localhost:5173 in dev,
# or HuggingFace Spaces domain in production) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://*.hf.space",
        "https://*.vercel.app",        # Vercel deployment
        "https://neural-style-transfer.vercel.app",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Directory setup
# ─────────────────────────────────────────────
BASE_DIR    = Path(__file__).parent
UPLOADS_DIR = BASE_DIR / "uploads"
OUTPUTS_DIR = BASE_DIR / "outputs"
STYLES_DIR  = BASE_DIR / "style_images"

for d in [UPLOADS_DIR, OUTPUTS_DIR, STYLES_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Serve output images as static files
app.mount("/outputs", StaticFiles(directory=str(OUTPUTS_DIR)), name="outputs")
app.mount("/style_images", StaticFiles(directory=str(STYLES_DIR)), name="style_images")


# ─────────────────────────────────────────────
# Job store (in-memory for simplicity)
# For production: replace with Redis or a database
# ─────────────────────────────────────────────
class JobStatus(str, Enum):
    PENDING    = "pending"
    PROCESSING = "processing"
    COMPLETED  = "completed"
    FAILED     = "failed"


# jobs dict: { job_id: JobRecord }
jobs: dict = {}
jobs_lock = threading.Lock()


class JobRecord:
    """Tracks the state of a single style transfer job."""
    def __init__(self, job_id: str):
        self.job_id      = job_id
        self.status      = JobStatus.PENDING
        self.step        = 0
        self.total_steps = 300
        self.content_loss: Optional[float] = None
        self.style_loss:   Optional[float] = None
        self.total_loss:   Optional[float] = None
        self.output_path:  Optional[str]   = None
        self.error:        Optional[str]   = None
        self.created_at    = datetime.utcnow().isoformat()
        self.completed_at: Optional[str]   = None


# ─────────────────────────────────────────────
# Pydantic response models
# ─────────────────────────────────────────────
class StylePreset(BaseModel):
    key:         str
    name:        str
    artist:      str
    description: str
    thumbnail:   Optional[str] = None


class StylesResponse(BaseModel):
    presets: list[StylePreset]


class StylizeResponse(BaseModel):
    job_id:  str
    message: str
    status:  str


class StatusResponse(BaseModel):
    job_id:       str
    status:       str
    progress:     float          # 0.0 to 1.0
    step:         int
    total_steps:  int
    content_loss: Optional[float]
    style_loss:   Optional[float]
    total_loss:   Optional[float]
    result_url:   Optional[str]
    error:        Optional[str]
    created_at:   str
    completed_at: Optional[str]


# ═══════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════

@app.get("/", summary="Health check")
@app.head("/", summary="Health check (HEAD)")
async def root():
    """Quick health check — confirms the API is running."""
    return {
        "status":  "running",
        "service": "Neural Style Transfer API",
        "version": "1.0.0",
        "docs":    "/docs",
    }


@app.get(
    "/styles",
    response_model=StylesResponse,
    summary="List available style presets",
)
async def list_styles():
    """
    Returns all available preset art styles.
    Each preset includes name, artist, description, and thumbnail URL.
    """
    presets = []
    for key, config in STYLE_PRESETS.items():
        # Build thumbnail URL if the style image exists on disk
        style_file = STYLES_DIR / config["filename"]
        thumbnail = f"/style_images/{config['filename']}" if style_file.exists() else None

        presets.append(StylePreset(
            key=key,
            name=config["name"],
            artist=config["artist"],
            description=config["description"],
            thumbnail=thumbnail,
        ))
    return StylesResponse(presets=presets)


@app.post(
    "/stylize",
    response_model=StylizeResponse,
    summary="Start a style transfer job",
)
async def stylize(
    background_tasks: BackgroundTasks,
    content_image: UploadFile = File(..., description="Your photo (JPG or PNG)"),
    style_image:   Optional[UploadFile] = File(None, description="Artwork to use as style (optional if preset given)"),
    preset:        Optional[str] = Form(None, description="Preset name (e.g. 'starry_night') — use instead of uploading style"),
    num_steps:     int           = Form(300,  description="Optimization steps (100-500). More = better quality, slower"),
    content_weight: float        = Form(1e4,  description="Content preservation strength"),
    style_weight:   float        = Form(1e6,  description="Style application strength"),
):
    """
    Upload a content image + style image (or pick a preset) to start style transfer.

    Returns a `job_id` immediately. Use `GET /status/{job_id}` to track progress.

    **Tips:**
    - Start with `num_steps=100` for a quick preview
    - Increase to 300-500 for final quality
    - Higher `style_weight` = more painterly, less photo-like
    """
    # ── Validate inputs ──────────────────────────────────
    if not style_image and not preset:
        raise HTTPException(
            status_code=400,
            detail="Provide either a style_image file or a preset name.",
        )
    if preset and preset not in STYLE_PRESETS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown preset '{preset}'. Available: {list(STYLE_PRESETS.keys())}",
        )

    # ── Validate file types ──────────────────────────────
    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
    if content_image.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Content image must be JPG/PNG/WEBP. Got: {content_image.content_type}",
        )

    # ── Create job ───────────────────────────────────────
    job_id = str(uuid.uuid4())
    job    = JobRecord(job_id)

    with jobs_lock:
        jobs[job_id] = job

    # ── Save content image ───────────────────────────────
    content_ext  = Path(content_image.filename or "content.jpg").suffix or ".jpg"
    content_path = str(UPLOADS_DIR / f"{job_id}_content{content_ext}")
    with open(content_path, "wb") as f:
        shutil.copyfileobj(content_image.file, f)

    # ── Determine style image path ───────────────────────
    if preset:
        preset_config = get_preset_config(preset)
        style_path    = str(STYLES_DIR / preset_config["filename"])

        if not Path(style_path).exists():
            raise HTTPException(
                status_code=404,
                detail=f"Style image for preset '{preset}' not found on server. "
                       f"Please upload the style images to backend/style_images/",
            )
        # Use preset's weights if user didn't override them
        content_weight = content_weight or preset_config["content_weight"]
        style_weight   = style_weight   or preset_config["style_weight"]
        num_steps      = num_steps      or preset_config["num_steps"]

    else:
        style_ext  = Path(style_image.filename or "style.jpg").suffix or ".jpg"
        style_path = str(UPLOADS_DIR / f"{job_id}_style{style_ext}")
        with open(style_path, "wb") as f:
            shutil.copyfileobj(style_image.file, f)

    # ── Output path ──────────────────────────────────────
    output_path = str(OUTPUTS_DIR / f"{job_id}_result.png")

    # ── Launch background job ────────────────────────────
    background_tasks.add_task(
        _run_nst_job,
        job_id=job_id,
        content_path=content_path,
        style_path=style_path,
        output_path=output_path,
        num_steps=num_steps,
        content_weight=content_weight,
        style_weight=style_weight,
    )

    return StylizeResponse(
        job_id=job_id,
        message="Style transfer job started. Poll /status/{job_id} for progress.",
        status=JobStatus.PENDING,
    )


@app.get(
    "/status/{job_id}",
    response_model=StatusResponse,
    summary="Get job status and progress",
)
async def get_status(job_id: str):
    """
    Poll this endpoint to track style transfer progress.

    Returns:
    - `status`: pending | processing | completed | failed
    - `progress`: 0.0 to 1.0 (percentage complete)
    - `result_url`: URL to download the image once completed
    """
    with jobs_lock:
        job = jobs.get(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    progress   = job.step / max(job.total_steps, 1)
    result_url = f"/result/{job_id}" if job.status == JobStatus.COMPLETED else None

    return StatusResponse(
        job_id=job.job_id,
        status=job.status,
        progress=round(progress, 3),
        step=job.step,
        total_steps=job.total_steps,
        content_loss=job.content_loss,
        style_loss=job.style_loss,
        total_loss=job.total_loss,
        result_url=result_url,
        error=job.error,
        created_at=job.created_at,
        completed_at=job.completed_at,
    )


@app.get(
    "/result/{job_id}",
    summary="Download the stylized image",
)
async def get_result(job_id: str):
    """
    Download the final stylized image as a PNG file.
    Only available after status is `completed`.
    """
    with jobs_lock:
        job = jobs.get(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Job not yet complete. Current status: {job.status}",
        )

    if not job.output_path or not Path(job.output_path).exists():
        raise HTTPException(status_code=404, detail="Output file not found on disk.")

    return FileResponse(
        path=job.output_path,
        media_type="image/png",
        filename=f"styled_{job_id[:8]}.png",
    )


@app.delete(
    "/job/{job_id}",
    summary="Delete a job and its files",
)
async def delete_job(job_id: str):
    """Clean up uploaded files and job record."""
    with jobs_lock:
        job = jobs.pop(job_id, None)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    # Remove any files associated with this job
    for pattern in [
        f"{job_id}_content*",
        f"{job_id}_style*",
        f"{job_id}_result*",
    ]:
        for f in UPLOADS_DIR.glob(pattern):
            f.unlink(missing_ok=True)
        for f in OUTPUTS_DIR.glob(pattern):
            f.unlink(missing_ok=True)

    return {"message": f"Job {job_id} and associated files deleted."}


@app.get("/jobs", summary="List all jobs (debug endpoint)")
async def list_jobs():
    """Returns all jobs in memory. Useful for debugging."""
    with jobs_lock:
        return {
            jid: {
                "status":   j.status,
                "progress": round(j.step / max(j.total_steps, 1), 2),
                "created":  j.created_at,
            }
            for jid, j in jobs.items()
        }


# ═══════════════════════════════════════════════════════════
# Background task runner
# ═══════════════════════════════════════════════════════════

def _run_nst_job(
    job_id:         str,
    content_path:   str,
    style_path:     str,
    output_path:    str,
    num_steps:      int,
    content_weight: float,
    style_weight:   float,
):
    """
    Runs in a background thread. Calls the NST engine and updates
    the job record with progress at each step.
    """
    with jobs_lock:
        job = jobs.get(job_id)
        if job:
            job.status      = JobStatus.PROCESSING
            job.total_steps = num_steps

    def progress_callback(step, total, content_loss, style_loss, total_loss):
        with jobs_lock:
            j = jobs.get(job_id)
            if j:
                j.step         = step
                j.content_loss = content_loss
                j.style_loss   = style_loss
                j.total_loss   = total_loss

    try:
        result_path = run_style_transfer(
            content_path=content_path,
            style_path=style_path,
            output_path=output_path,
            num_steps=num_steps,
            content_weight=content_weight,
            style_weight=style_weight,
            progress_callback=progress_callback,
        )
        with jobs_lock:
            j = jobs.get(job_id)
            if j:
                j.status       = JobStatus.COMPLETED
                j.step         = num_steps
                j.output_path  = result_path
                j.completed_at = datetime.utcnow().isoformat()

    except Exception as e:
        import traceback
        error_msg = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
        with jobs_lock:
            j = jobs.get(job_id)
            if j:
                j.status = JobStatus.FAILED
                j.error  = error_msg


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,        # Auto-reload on file changes (dev mode)
    )
