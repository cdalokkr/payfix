import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
RECORDINGS_DIR = STORAGE_DIR / "continuous"
EVENTS_DIR = STORAGE_DIR / "events"
SNAPSHOTS_DIR = STORAGE_DIR / "snapshots"
FACES_DIR = STORAGE_DIR / "faces"
PLATES_DIR = STORAGE_DIR / "plates"
MODELS_DIR = BASE_DIR.parent / "python-service"

# Ensure all directories exist
for folder in [STORAGE_DIR, RECORDINGS_DIR, EVENTS_DIR, SNAPSHOTS_DIR, FACES_DIR, PLATES_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    # Server network config
    HOST: str = os.getenv("VA_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("VA_PORT", "8000"))

    # Database
    DB_PATH: str = str(STORAGE_DIR / "analytics.db")

    # AI Models
    YUNET_MODEL_PATH: str = os.getenv(
        "YUNET_PATH",
        str(MODELS_DIR / "face_detection_yunet_2023mar.onnx")
    )
    ARCFACE_MODEL_PATH: str = os.getenv(
        "ARCFACE_PATH",
        str(MODELS_DIR / "w600k_mbf.onnx")
    )

    # Face Access Control
    FACE_SIMILARITY_THRESHOLD: float = float(os.getenv("FACE_SIMILARITY_THRESHOLD", "0.65"))

    # NVR Video Recording Config
    SEGMENT_DURATION_SECONDS: int = int(os.getenv("SEGMENT_DURATION_SECONDS", "300"))  # 5 min chunks
    PRE_EVENT_BUFFER_SECONDS: int = int(os.getenv("PRE_EVENT_BUFFER_SECONDS", "10"))
    POST_EVENT_BUFFER_SECONDS: int = int(os.getenv("POST_EVENT_BUFFER_SECONDS", "15"))
    FPS: int = int(os.getenv("RECORDING_FPS", "20"))
    FOURCC: str = "mp4v"  # widely compatible on Windows/Linux

    # Storage Janitor (Auto-Purge FIFO)
    RETENTION_DAYS: int = int(os.getenv("RETENTION_DAYS", "30"))
    MAX_DISK_USAGE_PERCENT: float = float(os.getenv("MAX_DISK_USAGE_PERCENT", "85.0"))
    JANITOR_INTERVAL_MINUTES: int = 15

    # Gate Relay / Webhook trigger
    GATE_RELAY_URL: str = os.getenv("GATE_RELAY_URL", "")

settings = Settings()
