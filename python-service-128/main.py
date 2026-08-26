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
from typing import List, Optional

import numpy as np
from PIL import Image, UnidentifiedImageError

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


def _error(
    message: str,
    code: str,
    *,
    face_detected: bool = False,
    face_count: int = 0,
) -> ExtractResponse:
    return ExtractResponse(
        success=False,
        embedding=None,
        error=message,
        error_code=code,
        face_detected=face_detected,
        face_count=face_count,
        dimensions=0,
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
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Image format could not be decoded") from exc

    if image.width * image.height > MAX_IMAGE_PIXELS:
        raise ValueError("Image dimensions exceed the maximum allowed size")

    return image.convert("RGB") if image.mode != "RGB" else image


def normalize_128d(vector: np.ndarray) -> np.ndarray:
    values = np.asarray(vector, dtype=np.float32).reshape(-1)
    if values.size != 128 or not np.all(np.isfinite(values)):
        raise ValueError("Face descriptor is not a finite 128-dimensional vector")
    norm = float(np.linalg.norm(values))
    if not math.isfinite(norm) or norm <= 1e-12:
        raise ValueError("Face descriptor has zero magnitude")
    return values / norm


def extract_face_vector(payload: ExtractRequest) -> ExtractResponse:
    if not FACE_REC_SUPPORT or face_recognition is None:
        return _error(
            "Face recognition model is unavailable.",
            "MODEL_UNAVAILABLE",
        )

    try:
        pil_image = decode_base64_image(payload.image_base64)
        image_np = np.asarray(pil_image)
        locations = face_recognition.face_locations(image_np, model=FACE_MODEL)
    except ValueError as exc:
        return _error(str(exc), "INVALID_IMAGE")
    except Exception:
        return _error("Face detection failed.", "DETECTION_ERROR")

    face_count = len(locations)
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

    return ExtractResponse(
        success=True,
        embedding=embedding,
        error=None,
        error_code=None,
        face_detected=True,
        face_count=1,
        dimensions=128,
    )


def compare_face_vectors(payload: CompareRequest) -> CompareResponse:
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
        # Do not return a misleading comparison for malformed or mismatched
        # vectors. Keep the endpoint's legacy HTTP shape but reject the input.
        return CompareResponse(
            matched=False,
            distance=float("inf"),
            similarity=0.0,
            dimensions=0,
            threshold_used=float(payload.threshold if payload.threshold is not None else 0.5),
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.getenv("FACE_API_HOST", "0.0.0.0"),
        port=int(os.getenv("FACE_API_PORT", "7860")),
    )