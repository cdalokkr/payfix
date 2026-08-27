"""Optimized direct FastAPI service for the PayFix 512-d develop pipeline.

The browser only sends natural 3:4 frames. This service owns detection, quality
assessment, ArcFace extraction, and canonical portrait creation. Client-side
face/eye guidance never grants access or supplies embeddings to this service.
"""

import base64
import io
import os
import secrets
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.request import Request, urlopen

import cv2
import numpy as np
import onnxruntime as ort
from fastapi import Depends, FastAPI, Header, HTTPException
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field


SERVICE_VERSION = "2.2.0"
EMBEDDING_PIPELINE_VERSION = "arcface-512-yunet-5pt-v1"
MODEL_PATH = Path(os.getenv("ARCFACE_MODEL_PATH", Path(__file__).with_name("w600k_mbf.onnx")))
FACE_DETECTOR_MODEL_PATH = Path(os.getenv(
    "FACE_DETECTOR_MODEL_PATH",
    Path(__file__).with_name("face_detection_yunet_2023mar.onnx"),
))
MODEL_URLS = (
    "https://huggingface.co/WePrompt/buffalo_sc/resolve/main/w600k_mbf.onnx",
    "https://huggingface.co/deepghs/insightface/resolve/main/buffalo_s/w600k_mbf.onnx",
)
MAX_INPUT_BYTES = int(os.getenv("MAX_INPUT_BYTES", str(7 * 1024 * 1024)))
MAX_IMAGE_PIXELS = int(os.getenv("MAX_IMAGE_PIXELS", str(4_000_000)))
DETECTION_MAX_DIMENSION = int(os.getenv("DETECTION_MAX_DIMENSION", "640"))
ARCFACE_THREADS = max(1, int(os.getenv("ARCFACE_THREADS", "1")))
MAX_CONCURRENT_INFERENCES = max(1, int(os.getenv("MAX_CONCURRENT_INFERENCES", "1")))
FACE_API_TOKEN = os.getenv("FACE_API_TOKEN", "").strip()

Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
cv2.setNumThreads(ARCFACE_THREADS)


class ExtractRequest(BaseModel):
    image_base64: str = Field(..., min_length=100)
    require_512: bool = True
    require_128: bool = True
    check_liveness: bool = True
    return_cropped_face: bool = False
    return_canonical_portrait: bool = True


class DiagnosticsInfo(BaseModel):
    face_box: Optional[Dict[str, int]] = None
    face_coverage_pct: float = 0.0
    brightness_score: float = 0.0
    contrast_score: float = 0.0
    sharpness_score: float = 0.0
    liveness_score: float = 0.0
    is_live: bool = False
    spoof_reasons: List[str] = Field(default_factory=list)
    timings_ms: Dict[str, float] = Field(default_factory=dict)
    backend_engine: str = "ArcFace-512 ONNX + OpenCV (optimized)"


class ExtractResponse(BaseModel):
    success: bool
    face_detected: bool
    face_count: int = 0
    embedding_512: Optional[List[float]] = None
    embedding_128: Optional[List[float]] = None
    embedding: Optional[List[float]] = None
    embedding_pipeline_version: Optional[str] = None
    cropped_face_base64: Optional[str] = None
    canonical_portrait_base64: Optional[str] = None
    canonical_portrait_aspect_ratio: Optional[str] = None
    canonical_portrait_width: Optional[int] = None
    canonical_portrait_height: Optional[int] = None
    dimensions: int = 0
    quality_score: float = 0.0
    is_live: bool = False
    liveness_score: float = 0.0
    diagnostics: Optional[DiagnosticsInfo] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    troubleshooting_tip: Optional[str] = None


class CompareRequest(BaseModel):
    embedding1: List[float]
    embedding2: List[float]
    threshold: Optional[float] = None


class CompareResponse(BaseModel):
    matched: bool
    similarity: float
    distance: float
    dimensions: int
    threshold_used: float
    confidence_level: str


class VerifyLiveRequest(BaseModel):
    image_base64: str
    stored_embedding: List[float]
    threshold: Optional[float] = None


class VerifyLiveResponse(BaseModel):
    success: bool
    matched: bool
    similarity: float
    is_live: bool
    liveness_score: float
    face_detected: bool
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    diagnostics: Optional[DiagnosticsInfo] = None


app = FastAPI(title="PayFix Face AI Service", version=SERVICE_VERSION, docs_url=None, redoc_url=None)
arcface_session: Optional[ort.InferenceSession] = None
session_lock = threading.Lock()
inference_gate = threading.BoundedSemaphore(MAX_CONCURRENT_INFERENCES)
face_detector = cv2.FaceDetectorYN.create(
    str(FACE_DETECTOR_MODEL_PATH),
    "",
    (320, 320),
    score_threshold=0.72,
    nms_threshold=0.30,
    top_k=5000,
)


def require_service_token(authorization: Optional[str] = Header(default=None)) -> None:
    """Require the server-to-server token for biometric operations.

    Health remains public so Cloud Run probes and deployment checks can inspect
    readiness without receiving biometric capabilities.
    """
    if not FACE_API_TOKEN:
        raise HTTPException(status_code=503, detail="FACE_API_TOKEN is not configured")
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token or not secrets.compare_digest(token, FACE_API_TOKEN):
        raise HTTPException(status_code=401, detail="Authentication required")


def ensure_model() -> None:
    if MODEL_PATH.exists() and MODEL_PATH.stat().st_size > 1_000_000:
        return
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    for url in MODEL_URLS:
        temporary_path = MODEL_PATH.with_suffix(".onnx.part")
        try:
            print(f"[ArcFace] Downloading model from {url}")
            request = Request(url, headers={"User-Agent": "PayFix-Biometric-Space/2.1"})
            with urlopen(request, timeout=90) as response, temporary_path.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            temporary_path.replace(MODEL_PATH)
            if MODEL_PATH.stat().st_size > 1_000_000:
                return
        except Exception as error:
            temporary_path.unlink(missing_ok=True)
            print(f"[ArcFace] Download failed: {error}")
    raise RuntimeError("ArcFace model is unavailable.")


def get_session() -> ort.InferenceSession:
    global arcface_session
    if arcface_session is not None:
        return arcface_session
    with session_lock:
        if arcface_session is None:
            ensure_model()
            options = ort.SessionOptions()
            options.intra_op_num_threads = ARCFACE_THREADS
            options.inter_op_num_threads = 1
            options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
            options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            arcface_session = ort.InferenceSession(
                str(MODEL_PATH),
                sess_options=options,
                providers=["CPUExecutionProvider"],
            )
            print(f"[ArcFace] Initialized: {arcface_session.get_providers()}")
    return arcface_session


def decode_base64_image(value: str) -> Image.Image:
    encoded = value.split(",", 1)[-1].strip().replace("\n", "").replace("\r", "")
    if len(encoded) * 3 // 4 > MAX_INPUT_BYTES:
        raise ValueError("IMAGE_TOO_LARGE")
    try:
        raw = base64.b64decode(encoded, validate=True)
        image = Image.open(io.BytesIO(raw))
        image.load()
    except (ValueError, UnidentifiedImageError, OSError) as error:
        raise ValueError("INVALID_IMAGE") from error
    if image.width * image.height > MAX_IMAGE_PIXELS:
        raise ValueError("IMAGE_DIMENSIONS_TOO_LARGE")
    image = image.convert("RGB")
    longest_side = max(image.size)
    if longest_side > 1600:
        scale = 1600 / longest_side
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    return image


def l2_normalize(vector: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(vector))
    return vector if norm == 0 else vector / norm


def detect_faces(image: Image.Image) -> List[Dict[str, Any]]:
    """Detect faces and return five landmarks for ArcFace alignment.

    Haar boxes are adequate for drawing a guide, but a direct resize of one is
    not a valid ArcFace input. YuNet's landmarks make the biometric template
    stable when an employee changes camera distance or has a slight rotation.
    """
    image_np = np.asarray(image)
    height, width = image_np.shape[:2]
    scale = min(1.0, DETECTION_MAX_DIMENSION / max(width, height))
    detection_image = image_np if scale == 1.0 else cv2.resize(
        image_np, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA
    )
    detection_height, detection_width = detection_image.shape[:2]
    face_detector.setInputSize((detection_width, detection_height))
    _, detected = face_detector.detect(cv2.cvtColor(detection_image, cv2.COLOR_RGB2BGR))
    if detected is None:
        return []
    inverse_scale = 1.0 / scale
    faces: List[Dict[str, Any]] = []
    for face in detected:
        x, y, face_width, face_height = face[:4]
        landmarks = [
            {"x": round(float(face[4 + index * 2]) * inverse_scale), "y": round(float(face[5 + index * 2]) * inverse_scale)}
            for index in range(5)
        ]
        faces.append({
            "top": round(float(y) * inverse_scale),
            "left": round(float(x) * inverse_scale),
            "width": round(float(face_width) * inverse_scale),
            "height": round(float(face_height) * inverse_scale),
            "landmarks": landmarks,
        })
    return faces


def assess_image_quality_and_liveness(image: Image.Image, face_box: Dict[str, int]) -> Dict[str, Any]:
    image_np = np.asarray(image, dtype=np.float32)
    height, width, _ = image_np.shape
    gray = 0.299 * image_np[:, :, 0] + 0.587 * image_np[:, :, 1] + 0.114 * image_np[:, :, 2]
    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))
    gy, gx = np.gradient(gray)
    sharpness = float(np.var(np.sqrt(gx ** 2 + gy ** 2)))
    coverage = round((face_box["width"] * face_box["height"] / max(1, width * height)) * 100, 1)
    reasons: List[str] = []
    score = 1.0
    if brightness < 30:
        reasons.append("POOR_LIGHTING_TOO_DARK")
        score -= 0.35
    elif brightness > 235:
        reasons.append("OVEREXPOSED_TOO_BRIGHT")
        score -= 0.25
    if sharpness < 15:
        reasons.append("BLURRY_IMAGE_LOW_SHARPNESS")
        score -= 0.30
    if coverage < 3:
        reasons.append("FACE_TOO_FAR_FROM_CAMERA")
        score -= 0.20
    score = max(0.0, min(1.0, score))
    return {
        "brightness": round(brightness, 2),
        "contrast": round(contrast, 2),
        "sharpness": round(sharpness, 2),
        "coverage_pct": coverage,
        "liveness_score": round(score, 3),
        "is_live": score >= 0.5 and "POOR_LIGHTING_TOO_DARK" not in reasons,
        "spoof_reasons": reasons,
    }


def aligned_arcface_crop(image: Image.Image, landmarks: List[Dict[str, int]]) -> Image.Image:
    """Warp YuNet's five facial landmarks to ArcFace's canonical 112px pose."""
    if len(landmarks) != 5:
        raise ValueError("FIVE_POINT_ALIGNMENT_UNAVAILABLE")
    # YuNet returns right eye, left eye, nose, right mouth corner, left mouth
    # corner. Sorting the eye and mouth pairs also handles mirrored portrait
    # camera frames.
    eyes = sorted(landmarks[:2], key=lambda point: point["x"])
    nose = landmarks[2]
    mouth = sorted(landmarks[3:], key=lambda point: point["x"])
    source = np.float32([
        [eyes[0]["x"], eyes[0]["y"]],
        [eyes[1]["x"], eyes[1]["y"]],
        [nose["x"], nose["y"]],
        [mouth[0]["x"], mouth[0]["y"]],
        [mouth[1]["x"], mouth[1]["y"]],
    ])
    destination = np.float32([
        [38.2946, 51.6963],
        [73.5318, 51.5014],
        [56.0252, 71.7366],
        [41.5493, 92.3655],
        [70.7299, 92.2041],
    ])
    transform, _ = cv2.estimateAffinePartial2D(source, destination, method=cv2.LMEDS)
    if transform is None:
        raise ValueError("FIVE_POINT_ALIGNMENT_FAILED")
    aligned = cv2.warpAffine(
        np.asarray(image),
        transform,
        (112, 112),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REFLECT101,
    )
    return Image.fromarray(aligned, mode="RGB")


def crop_face_avatar(image: Image.Image, face_box: Dict[str, Any]) -> tuple[Image.Image, Image.Image, Image.Image]:
    image_width, image_height = image.size
    left, top, width, height = (face_box[key] for key in ("left", "top", "width", "height"))
    center_x, center_y = left + width / 2, top + height / 2
    square_size = max(width, height) * 1.30
    square = image.crop((
        max(0, int(center_x - square_size / 2)),
        max(0, int(center_y - square_size * 0.52)),
        min(image_width, int(center_x + square_size / 2)),
        min(image_height, int(center_y + square_size * 0.48)),
    ))

    # Cap the source window before positioning it so extreme close-ups still
    # preserve a real 3:4 portrait instead of stretching an edge-clamped crop.
    portrait_height = min(
        max(height * 2.70, width * 2.20),
        image_height,
        image_width / 0.75,
    )
    portrait_width = portrait_height * 0.75
    portrait_left = center_x - portrait_width / 2
    # Bias very slightly upward to leave consistent space around the hair
    # while retaining ears and chin in the review portrait.
    portrait_top = top + height * 0.56 - portrait_height / 2
    portrait_left = max(0, min(portrait_left, image_width - portrait_width))
    portrait_top = max(0, min(portrait_top, image_height - portrait_height))
    portrait = image.crop((
        int(portrait_left),
        int(portrait_top),
        min(image_width, int(portrait_left + portrait_width)),
        min(image_height, int(portrait_top + portrait_height)),
    ))
    return (
        square.resize((512, 512), Image.Resampling.LANCZOS),
        aligned_arcface_crop(image, face_box["landmarks"]),
        portrait.resize((480, 640), Image.Resampling.LANCZOS),
    )


def encode_jpeg(image: Image.Image, quality: int = 90) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=quality, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode()


def compute_embedding(crop_112: Image.Image) -> List[float]:
    session = get_session()
    image_np = np.asarray(crop_112, dtype=np.float32)
    bgr = image_np[:, :, ::-1]
    tensor = np.expand_dims(np.transpose((bgr - 127.5) / 127.5, (2, 0, 1)), axis=0).astype(np.float32)
    vector = session.run(None, {session.get_inputs()[0].name: tensor})[0][0]
    return l2_normalize(vector).tolist()


def extract(payload: ExtractRequest) -> ExtractResponse:
    started = time.perf_counter()
    timings: Dict[str, float] = {}
    try:
        image = decode_base64_image(payload.image_base64)
    except ValueError as error:
        code = str(error)
        return ExtractResponse(
            success=False, face_detected=False, error_code=code,
            error_message="The camera image is invalid or too large.",
            troubleshooting_tip="Capture a new selfie in good light.",
        )

    with inference_gate:
        detected_at = time.perf_counter()
        try:
            faces = detect_faces(image)
        except Exception:
            faces = []
        timings["detection_ms"] = round((time.perf_counter() - detected_at) * 1000, 2)
        if not faces:
            return ExtractResponse(
                success=False, face_detected=False, face_count=0, error_code="NO_FACE_DETECTED",
                error_message="No clear face was detected.",
                troubleshooting_tip="Center one face in the camera oval and improve lighting.",
            )
        faces.sort(key=lambda face: face["width"] * face["height"], reverse=True)
        primary = faces[0]
        significant = [face for face in faces if face["width"] * face["height"] >= primary["width"] * primary["height"] * 0.25]
        if len(significant) > 1:
            return ExtractResponse(
                success=False, face_detected=True, face_count=len(significant), error_code="MULTIPLE_FACES_DETECTED",
                error_message=f"{len(significant)} faces were detected.",
                troubleshooting_tip="Keep only one person in the camera frame.",
            )

        quality_at = time.perf_counter()
        quality = assess_image_quality_and_liveness(image, primary)
        timings["liveness_ms"] = round((time.perf_counter() - quality_at) * 1000, 2)
        embedding_at = time.perf_counter()
        crop_512, crop_112, portrait = crop_face_avatar(image, primary)
        embedding_512 = compute_embedding(crop_112)
        timings["embedding_512_ms"] = round((time.perf_counter() - embedding_at) * 1000, 2)

    timings["total_ms"] = round((time.perf_counter() - started) * 1000, 2)
    diagnostics = DiagnosticsInfo(
        face_box={
            "top": primary["top"],
            "left": primary["left"],
            "width": primary["width"],
            "height": primary["height"],
            "right": primary["left"] + primary["width"],
            "bottom": primary["top"] + primary["height"],
        },
        face_coverage_pct=quality["coverage_pct"],
        brightness_score=quality["brightness"],
        contrast_score=quality["contrast"],
        sharpness_score=quality["sharpness"],
        liveness_score=quality["liveness_score"],
        is_live=quality["is_live"],
        spoof_reasons=quality["spoof_reasons"],
        timings_ms=timings,
    )
    return ExtractResponse(
        success=True,
        face_detected=True,
        face_count=1,
        embedding_512=embedding_512 if payload.require_512 else None,
        embedding_128=embedding_512[:128] if payload.require_128 else None,
        embedding=embedding_512 if payload.require_512 else embedding_512[:128],
        embedding_pipeline_version=EMBEDDING_PIPELINE_VERSION,
        cropped_face_base64=encode_jpeg(crop_512, 90) if payload.return_cropped_face else None,
        canonical_portrait_base64=encode_jpeg(portrait, 90) if payload.return_canonical_portrait else None,
        canonical_portrait_aspect_ratio="3:4" if payload.return_canonical_portrait else None,
        canonical_portrait_width=480 if payload.return_canonical_portrait else None,
        canonical_portrait_height=640 if payload.return_canonical_portrait else None,
        dimensions=512,
        quality_score=quality["liveness_score"],
        is_live=quality["is_live"],
        liveness_score=quality["liveness_score"],
        diagnostics=diagnostics,
    )


def compare(payload: CompareRequest) -> CompareResponse:
    left, right = np.asarray(payload.embedding1, dtype=np.float32), np.asarray(payload.embedding2, dtype=np.float32)
    if left.shape != right.shape or not left.size:
        return CompareResponse(matched=False, similarity=0, distance=0, dimensions=0, threshold_used=payload.threshold or 0, confidence_level="REJECTED")
    left, right = l2_normalize(left), l2_normalize(right)
    similarity = max(0.0, min(1.0, float(np.dot(left, right))))
    threshold = payload.threshold if payload.threshold is not None else (0.50 if len(left) == 512 else 0.60)
    return CompareResponse(
        matched=similarity >= threshold,
        similarity=round(similarity, 4),
        distance=round(float(np.linalg.norm(left - right)), 4),
        dimensions=len(left),
        threshold_used=threshold,
        confidence_level="HIGH" if similarity >= 0.65 else ("MEDIUM" if similarity >= 0.55 else ("LOW" if similarity >= threshold else "REJECTED")),
    )


@app.on_event("startup")
def warm_session() -> None:
    get_session()


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "healthy" if arcface_session is not None else "warming",
        "service": "PayFix Biometric AI",
        "version": SERVICE_VERSION,
        "engine": "ArcFace-512 ONNX + OpenCV (optimized)",
        "model_ready": arcface_session is not None,
        "detection_max_dimension": DETECTION_MAX_DIMENSION,
        "arcface_threads": ARCFACE_THREADS,
        "max_concurrent_inferences": MAX_CONCURRENT_INFERENCES,
    }


@app.post("/extract", response_model=ExtractResponse)
def extract_endpoint(payload: ExtractRequest, _: None = Depends(require_service_token)) -> ExtractResponse:
    return extract(payload)


@app.post("/compare", response_model=CompareResponse)
def compare_endpoint(payload: CompareRequest, _: None = Depends(require_service_token)) -> CompareResponse:
    return compare(payload)


@app.post("/verify-live", response_model=VerifyLiveResponse)
def verify_live(payload: VerifyLiveRequest, _: None = Depends(require_service_token)) -> VerifyLiveResponse:
    result = extract(ExtractRequest(image_base64=payload.image_base64, require_512=len(payload.stored_embedding) == 512, require_128=len(payload.stored_embedding) == 128))
    if not result.success or not result.embedding:
        return VerifyLiveResponse(
            success=False, matched=False, similarity=0, is_live=False, liveness_score=0,
            face_detected=result.face_detected, error_code=result.error_code,
            error_message=result.error_message, diagnostics=result.diagnostics,
        )
    matched = compare(CompareRequest(embedding1=result.embedding, embedding2=payload.stored_embedding, threshold=payload.threshold))
    return VerifyLiveResponse(
        success=True, matched=matched.matched, similarity=matched.similarity, is_live=result.is_live,
        liveness_score=result.liveness_score, face_detected=True, diagnostics=result.diagnostics,
    )