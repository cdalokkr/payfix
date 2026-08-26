"""
PayFix legacy-compatible 128-d face service.

This service is intentionally separate from python-service/, which is the
develop branch's 512-d ArcFace service. It preserves the old REST response
shape while failing closed when dlib/face_recognition is unavailable.
"""

import base64
import binascii
import io
import math
import os
import sys
import time
from typing import Dict, List, Optional

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

try:
    import face_recognition
    FACE_REC_SUPPORT = True
    FACE_REC_IMPORT_ERROR = None
except ImportError as exc:
    face_recognition = None
    FACE_REC_SUPPORT = False
    FACE_REC_IMPORT_ERROR = str(exc)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


MAX_IMAGE_BYTES = int(os.getenv("FACE_MAX_IMAGE_BYTES", str(8 * 1024 * 1024)))
MAX_IMAGE_PIXELS = int(os.getenv("FACE_MAX_IMAGE_PIXELS", "12000000"))
MAX_PROCESSING_EDGE = int(os.getenv("FACE_MAX_PROCESSING_EDGE", "640"))
MIN_FACE_COVERAGE_PCT = float(os.getenv("FACE_MIN_COVERAGE_PCT", "5.0"))
MIN_FACE_EDGE_PX = int(os.getenv("FACE_MIN_EDGE_PX", "64"))
MIN_FACE_BRIGHTNESS = float(os.getenv("FACE_MIN_BRIGHTNESS", "42"))
MAX_FACE_BRIGHTNESS = float(os.getenv("FACE_MAX_BRIGHTNESS", "225"))
MIN_FACE_CONTRAST = float(os.getenv("FACE_MIN_CONTRAST", "16"))
MIN_FACE_SHARPNESS = float(os.getenv("FACE_MIN_SHARPNESS", "3.0"))
FACE_MODEL = os.getenv("FACE_RECOGNITION_MODEL", "hog").strip().lower()
if FACE_MODEL not in {"hog", "cnn"}:
    FACE_MODEL = "hog"

app = FastAPI(
    title="PayFix Legacy 128-d Face Vector Service",
    description="Fail-closed compatibility service for legacy 128-d face descriptors",
    version="1.1.0",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv("FACE_API_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class ExtractRequest(BaseModel):
    image_base64: str = Field(..., min_length=1)


class ExtractResponse(BaseModel):
    success: bool
    embedding: Optional[List[float]] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    face_detected: bool
    face_count: int = 0
    dimensions: int = 0
    diagnostics: Optional[Dict[str, object]] = None


class CompareRequest(BaseModel):
    embedding1: List[float]
    embedding2: List[float]
    # Legacy contract: this is an Euclidean-distance threshold.
    threshold: Optional[float] = Field(default=0.5, ge=0.0)


class CompareResponse(BaseModel):
    matched: bool
    distance: float
    similarity: float
    dimensions: int
    threshold_used: float
    error: Optional[str] = None
    error_code: Optional[str] = None
    timings_ms: Optional[Dict[str, float]] = None


def _error(
    message: str,
    code: str,
    *,
    face_detected: bool = False,
    face_count: int = 0,
    diagnostics: Optional[Dict[str, object]] = None,
) -> ExtractResponse:
    return ExtractResponse(
        success=False,
        embedding=None,
        error=message,
        error_code=code,
        face_detected=face_detected,
        face_count=face_count,
        dimensions=0,
        diagnostics=diagnostics,
    )


def decode_base64_image(base64_str: str) -> Image.Image:
    encoded = base64_str.split(",", 1)[1] if "," in base64_str else base64_str
    encoded = "".join(encoded.split())
    try:
        image_data = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Invalid base64 image data") from exc

    if len(image_data) > MAX_IMAGE_BYTES:
        raise ValueError("Image exceeds the maximum allowed size")

    try:
        image = Image.open(io.BytesIO(image_data))
        image = ImageOps.exif_transpose(image)
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Image format could not be decoded") from exc

    if image.width * image.height > MAX_IMAGE_PIXELS:
        raise ValueError("Image dimensions exceed the maximum allowed size")

    return image.convert("RGB") if image.mode != "RGB" else image


def cap_processing_image(image: Image.Image) -> Image.Image:
    longest_edge = max(image.width, image.height)
    if longest_edge <= MAX_PROCESSING_EDGE:
        return image
    scale = MAX_PROCESSING_EDGE / longest_edge
    size = (
        max(1, round(image.width * scale)),
        max(1, round(image.height * scale)),
    )
    return image.resize(size, Image.Resampling.LANCZOS)


def normalize_128d(vector: np.ndarray) -> np.ndarray:
    values = np.asarray(vector, dtype=np.float32).reshape(-1)
    if values.size != 128 or not np.all(np.isfinite(values)):
        raise ValueError("Face descriptor is not a finite 128-dimensional vector")
    norm = float(np.linalg.norm(values))
    if not math.isfinite(norm) or norm <= 1e-12:
        raise ValueError("Face descriptor has zero magnitude")
    return values / norm


def face_quality_metrics(
    image: np.ndarray,
    location: tuple[int, int, int, int],
) -> Dict[str, float]:
    top, right, bottom, left = location
    height, width = image.shape[:2]
    top, bottom = max(0, top), min(height, bottom)
    left, right = max(0, left), min(width, right)
    face = image[top:bottom, left:right]
    if face.size == 0:
        raise ValueError("Detected face bounds are invalid")

    gray = np.dot(face[..., :3], [0.299, 0.587, 0.114]).astype(np.float32)
    grad_y, grad_x = np.gradient(gray)
    face_width = right - left
    face_height = bottom - top
    coverage_pct = 100.0 * (face_width * face_height) / (width * height)

    return {
        "face_width_px": float(face_width),
        "face_height_px": float(face_height),
        "face_coverage_pct": round(coverage_pct, 3),
        "brightness_score": round(float(np.mean(gray)), 3),
        "contrast_score": round(float(np.std(gray)), 3),
        "sharpness_score": round(float(np.mean(grad_x ** 2 + grad_y ** 2)), 3),
        "processing_width": float(width),
        "processing_height": float(height),
    }


def quality_error(metrics: Dict[str, float]) -> Optional[tuple[str, str]]:
    if (
        metrics["face_width_px"] < MIN_FACE_EDGE_PX
        or metrics["face_height_px"] < MIN_FACE_EDGE_PX
        or metrics["face_coverage_pct"] < MIN_FACE_COVERAGE_PCT
    ):
        return (
            "Move closer so your face fills more of the guide.",
            "FACE_TOO_SMALL",
        )
    if metrics["brightness_score"] < MIN_FACE_BRIGHTNESS:
        return ("Improve the lighting on your face.", "IMAGE_TOO_DARK")
    if metrics["brightness_score"] > MAX_FACE_BRIGHTNESS:
        return ("Avoid strong backlight or glare on your face.", "IMAGE_TOO_BRIGHT")
    if metrics["contrast_score"] < MIN_FACE_CONTRAST:
        return ("Use clearer, more even lighting.", "LOW_CONTRAST")
    if metrics["sharpness_score"] < MIN_FACE_SHARPNESS:
        return ("Hold the camera steady and retake the photo.", "IMAGE_TOO_BLURRY")
    return None


def extract_face_vector(payload: ExtractRequest) -> ExtractResponse:
    started_at = time.perf_counter()
    if not FACE_REC_SUPPORT or face_recognition is None:
        return _error(
            "Face recognition model is unavailable.",
            "MODEL_UNAVAILABLE",
        )

    try:
        pil_image = decode_base64_image(payload.image_base64)
        decode_ms = (time.perf_counter() - started_at) * 1000
        pil_image = cap_processing_image(pil_image)
        image_np = np.asarray(pil_image)
        locations = face_recognition.face_locations(image_np, model=FACE_MODEL)
    except ValueError as exc:
        return _error(str(exc), "INVALID_IMAGE")
    except Exception:
        return _error("Face detection failed.", "DETECTION_ERROR")

    face_count = len(locations)
    detection_ms = (time.perf_counter() - started_at) * 1000
    if face_count == 0:
        return _error("No face detected in the image.", "NO_FACE_DETECTED")
    if face_count > 1:
        return _error(
            "Exactly one face must be visible in the image.",
            "MULTIPLE_FACES_DETECTED",
            face_detected=True,
            face_count=face_count,
        )

    try:
        metrics = face_quality_metrics(image_np, locations[0])
        quality_failure = quality_error(metrics)
        if quality_failure:
            message, code = quality_failure
            return _error(
                message,
                code,
                face_detected=True,
                face_count=1,
                diagnostics={"quality": metrics},
            )

        encodings = face_recognition.face_encodings(
            image_np,
            known_face_locations=locations,
            num_jitters=1,
            model="small",
        )
        if len(encodings) != 1:
            return _error(
                "Could not compute one face descriptor.",
                "DESCRIPTOR_FAILED",
                face_detected=True,
                face_count=face_count,
            )
        embedding = normalize_128d(encodings[0]).tolist()
    except Exception:
        return _error(
            "Could not compute the face descriptor.",
            "DESCRIPTOR_FAILED",
            face_detected=True,
            face_count=face_count,
        )

    total_ms = (time.perf_counter() - started_at) * 1000
    return ExtractResponse(
        success=True,
        embedding=embedding,
        error=None,
        error_code=None,
        face_detected=True,
        face_count=1,
        dimensions=128,
        diagnostics={
            "quality": metrics,
            "timings_ms": {
                "decode": round(decode_ms, 2),
                "detect": round(detection_ms - decode_ms, 2),
                "encode": round(total_ms - detection_ms, 2),
                "total": round(total_ms, 2),
            },
        },
    )


def compare_face_vectors(payload: CompareRequest) -> CompareResponse:
    started_at = time.perf_counter()
    try:
        emb1 = normalize_128d(np.asarray(payload.embedding1, dtype=np.float32))
        emb2 = normalize_128d(np.asarray(payload.embedding2, dtype=np.float32))
    except ValueError as exc:
        raise ValueError(str(exc)) from exc

    distance = float(np.linalg.norm(emb1 - emb2))
    similarity = max(0.0, min(1.0, 1.0 - distance))
    threshold = float(payload.threshold if payload.threshold is not None else 0.5)

    return CompareResponse(
        matched=distance < threshold,
        distance=round(distance, 6),
        similarity=round(similarity, 6),
        dimensions=128,
        threshold_used=threshold,
        error=None,
        error_code=None,
        timings_ms={"total": round((time.perf_counter() - started_at) * 1000, 2)},
    )


@app.get("/health")
def health_check():
    if FACE_REC_SUPPORT:
        return {
            "status": "healthy",
            "backend": "face_recognition (dlib)",
            "dimensions": 128,
            "model": FACE_MODEL,
            "version": "1.1.0",
        }
    return {
        "status": "unhealthy",
        "backend": "unavailable",
        "dimensions": 128,
        "version": "1.1.0",
        "error_code": "MODEL_UNAVAILABLE",
    }


@app.post("/extract", response_model=ExtractResponse)
def extract_endpoint(payload: ExtractRequest):
    return extract_face_vector(payload)


@app.post("/compare", response_model=CompareResponse)
def compare_endpoint(payload: CompareRequest):
    try:
        return compare_face_vectors(payload)
    except ValueError:
        # Keep the endpoint's legacy JSON shape but make invalid vectors
        # explicit; never fabricate a comparison score.
        return CompareResponse(
            matched=False,
            distance=0.0,
            similarity=0.0,
            dimensions=0,
            threshold_used=float(payload.threshold if payload.threshold is not None else 0.5),
            error="Embeddings must be finite 128-dimensional vectors.",
            error_code="INVALID_EMBEDDING",
            timings_ms={"total": 0.0},
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.getenv("FACE_API_HOST", "0.0.0.0"),
        port=int(os.getenv("FACE_API_PORT", "7860")),
    )